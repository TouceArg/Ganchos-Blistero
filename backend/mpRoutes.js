const { Router } = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { GoogleAuth } = require("google-auth-library");
require("dotenv").config();

const router = Router();

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const MP_SELLER_ID = process.env.MP_SELLER_ID || "264146233";
const ORDER_SHEET_NAME = process.env.ORDER_SHEET_NAME || "orders";
const DOC_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const MP_API_BASE = "https://api.mercadopago.com";
const ML_API_BASE = "https://api.mercadolibre.com";
const ENVIA_API_KEY = process.env.ENVIA_API_KEY || "";
const ENVIA_API_BASE = process.env.ENVIA_API_BASE || "https://api.envia.com/ship";
const ENVIA_DEFAULTS = {
  length: Number(process.env.ENVIA_PKG_LENGTH || 12),
  width: Number(process.env.ENVIA_PKG_WIDTH || 10),
  height: Number(process.env.ENVIA_PKG_HEIGHT || 5),
  weight: Number(process.env.ENVIA_PKG_WEIGHT || 0.2), // kg
};

let cachedDoc = null;
let cachedDocAt = 0;

async function getDoc() {
  const now = Date.now();
  if (cachedDoc && now - cachedDocAt < DOC_CACHE_TTL_MS) return cachedDoc;
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GS_CLIENT_EMAIL,
      private_key: process.env.GS_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
  await doc.loadInfo();
  cachedDoc = doc;
  cachedDocAt = now;
  return cachedDoc;
}

async function ensureOrderSheet(doc) {
  const existing = doc.sheetsByTitle[ORDER_SHEET_NAME];
  if (existing) return existing;
  return doc.addSheet({
    title: ORDER_SHEET_NAME,
    headerValues: [
      "order_id",
      "created_at",
      "name",
      "email",
      "phone",
      "address_street",
      "address_floor",
      "address_city",
      "address_state",
      "address_country",
      "address_zip",
      "total",
      "status",
      "items_json",
      "notes",
    ],
  });
}

function mapOrderRow(row) {
  const get = (key) => (typeof row.get === "function" ? row.get(key) : row[key]);
  return {
    order_id: get("order_id"),
    created_at: get("created_at"),
    name: get("name"),
    email: get("email"),
    phone: get("phone"),
    address_street: get("address_street"),
    address_floor: get("address_floor"),
    address_city: get("address_city"),
    address_state: get("address_state"),
    address_country: get("address_country"),
    address_zip: get("address_zip"),
    total: Number(get("total") || 0),
    status: get("status") || "pending",
    items_json: get("items_json") || "[]",
    notes: get("notes") || "",
    tracking_url: get("tracking_url") || "",
    tracking_number: get("tracking_number") || "",
    shipping_status: get("shipping_status") || "",
    shipment_id: get("shipment_id") || "",
  };
}

async function updateOrderStatus(orderId, status, notes) {
  const doc = await getDoc();
  const sheet = await ensureOrderSheet(doc);
  const rows = await sheet.getRows();
  const row = rows.find((r) => {
    const get = typeof r.get === "function" ? r.get.bind(r) : r;
    return (get("order_id") || get.order_id) === orderId;
  });
  if (!row) {
    console.error("No se encontró orden para actualizar estado", orderId);
    return false;
  }
  if (status) row.set("status", status);
  if (notes) {
    const prev = row.get("notes") || row.notes || "";
    // Evita duplicar la misma nota si ya está presente
    const already = prev.includes(notes);
    const combined = already ? prev : (prev ? `${prev} | ${notes}` : notes);
    row.set("notes", combined);
  }
  await row.save();
  return true;
}

async function findPaymentByExternalRef(externalRef) {
  if (!externalRef) return null;
  const searchRes = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}`,
    { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
  );
  const data = await searchRes.json();
  if (!searchRes.ok) {
    console.error("MP search error:", data);
    return null;
  }
  return Array.isArray(data.results) && data.results.length ? data.results[0] : null;
}

function isAdmin(req) {
  if (!ADMIN_TOKEN) return true;
  const t = req.headers["x-admin-token"] || req.query.token;
  return t === ADMIN_TOKEN;
}

async function fetchMerchantOrderShipment(payment) {
  try {
    const moId = payment?.order?.id;
    if (!moId) return null;
    const moRes = await fetch(`${MP_API_BASE}/merchant_orders/${moId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const mo = await moRes.json();
    if (!moRes.ok) {
      console.error("MP merchant_order error:", mo);
      return null;
    }
    if (Array.isArray(mo.shipments) && mo.shipments.length) {
      const first = mo.shipments[0];
      return first.id || first.shipment_id || null;
    }
    return null;
  } catch (e) {
    console.error("Error leyendo merchant_order para shipment", e);
    return null;
  }
}

function buildShipments(body = {}) {
  // ME2 deshabilitado: no enviamos bloque de envios a MP
  return null;
}

const normalizePostalCode = (val = "") => {
  const clean = String(val || "").match(/\d+/g);
  return clean ? clean.join("").slice(0, 10) : "";
};

const normalizeState = (val = "") => String(val || "").trim();

function buildEnviaOrigin() {
  return {
    name: process.env.ENVIA_ORIGIN_NAME || process.env.ENVIA_ORIGIN_COMPANY || "Ganchos Blisteros",
    company: process.env.ENVIA_ORIGIN_COMPANY || process.env.ENVIA_ORIGIN_NAME || "Ganchos Blisteros",
    email: process.env.ENVIA_ORIGIN_EMAIL || process.env.MAIL_USER || "",
    phone: process.env.ENVIA_ORIGIN_PHONE || "",
    street: process.env.ENVIA_ORIGIN_STREET || "",
    number: process.env.ENVIA_ORIGIN_NUMBER || "",
    district: process.env.ENVIA_ORIGIN_DISTRICT || "",
    city: process.env.ENVIA_ORIGIN_CITY || "",
    state: normalizeState(process.env.ENVIA_ORIGIN_STATE || ""),
    country: process.env.ENVIA_ORIGIN_COUNTRY || "AR",
    postalCode: normalizePostalCode(process.env.ENVIA_ORIGIN_ZIP || ""),
    reference: process.env.ENVIA_ORIGIN_REF || "",
  };
}

function buildEnviaDestination(body = {}) {
  const addr = body.address || {};
  return {
    name: addr.name || body.name || "",
    company: addr.company || "",
    email: addr.email || body.email || "",
    phone: addr.phone || body.phone || "",
    street: addr.street || body.calle || "",
    number: addr.number || body.numero || "",
    district: addr.district || "",
    city: addr.city || body.city || addr.city || "",
    state: normalizeState(addr.state || body.state || body.provincia || ""),
    country: addr.country || body.pais || "AR",
    postalCode: normalizePostalCode(addr.zip || addr.postalCode || body.cp || ""),
    reference: addr.reference || "",
  };
}

function buildEnviaPackages(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return [
      {
        content: "Ganchos",
        amount: 1,
        type: "box",
        length: ENVIA_DEFAULTS.length,
        width: ENVIA_DEFAULTS.width,
        height: ENVIA_DEFAULTS.height,
        weight: ENVIA_DEFAULTS.weight,
        declaredValue: 1,
      },
    ];
  }
  return items.map((it) => {
    const qty = Number(it.quantity || it.qty || 1);
    const length = Number(it.length || it.length_cm || ENVIA_DEFAULTS.length);
    const width = Number(it.width || it.width_cm || ENVIA_DEFAULTS.width);
    const height = Number(it.height || it.height_cm || ENVIA_DEFAULTS.height);
    const weight =
      Number(it.weight_kg) ||
      (Number(it.weight_g) ? Number(it.weight_g) / 1000 : ENVIA_DEFAULTS.weight);
    const declaredValue = Math.max(1, Number(it.price || it.unit_price || 0) * qty || 1);
    return {
      content: it.name || it.title || "Item",
      amount: qty,
      type: "box",
      length,
      width,
      height,
      weight: weight || ENVIA_DEFAULTS.weight,
      declaredValue,
    };
  });
}

async function getOrderById(orderId) {
  const doc = await getDoc();
  const sheet = await ensureOrderSheet(doc);
  const rows = await sheet.getRows();
  const row = rows.find((r) => {
    const get = typeof r.get === "function" ? r.get.bind(r) : r;
    return (get("order_id") || get.order_id) === orderId;
  });
  return row ? mapOrderRow(row) : null;
}

async function updateOrderShipping(orderId, data = {}) {
  const doc = await getDoc();
  const sheet = await ensureOrderSheet(doc);
  const rows = await sheet.getRows();
  const row = rows.find((r) => {
    const get = typeof r.get === "function" ? r.get.bind(r) : r;
    return (get("order_id") || get.order_id) === orderId;
  });
  if (!row) return false;
  if (data.tracking_url !== undefined) row.set("tracking_url", data.tracking_url || "");
  if (data.tracking_number !== undefined) row.set("tracking_number", data.tracking_number || "");
  if (data.shipment_id !== undefined) row.set("shipment_id", data.shipment_id || "");
  if (data.shipping_status !== undefined) row.set("shipping_status", data.shipping_status || "");
  if (data.status !== undefined) row.set("status", data.status || row.get("status") || "pending");
  if (data.notesAppend) {
    const prev = row.get("notes") || "";
    const exists = prev.includes(data.notesAppend);
    row.set("notes", exists ? prev : `${prev ? `${prev} | ` : ""}${data.notesAppend}`);
  }
  await row.save();
  return true;
}

async function createEnviaShipmentForOrder(orderId) {
  if (!ENVIA_API_KEY) return { ok: false, reason: "ENVIA_API_KEY missing" };
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.shipment_id) return { ok: true, skipped: true, shipment_id: order.shipment_id };
  const items = (() => {
    try {
      return JSON.parse(order.items_json || "[]");
    } catch (_) {
      return [];
    }
  })();
  const payload = {
    origin: buildEnviaOrigin(),
    destination: {
      name: order.name || "",
      company: "",
      email: order.email || "",
      phone: order.phone || "",
      street: order.address_street || "",
      number: "",
      district: "",
      city: order.address_city || "",
      state: order.address_state || "",
      country: order.address_country || "AR",
      postalCode: order.address_zip || "",
      reference: order.address_floor || "",
    },
    packages: buildEnviaPackages(items),
    reference: order.order_id,
    labelFormat: "pdf",
  };
  const resp = await fetch(`${ENVIA_API_BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENVIA_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("Envia generate error:", data);
    return { ok: false, reason: "envia_error", detail: data };
  }
  const first =
    (Array.isArray(data) && data[0]) ||
    data?.data?.[0] ||
    data?.result?.data?.[0] ||
    data?.result ||
    data;
  const shipment_id = first?.shipment_id || first?.id || first?.shipmentId || "";
  const tracking_number =
    first?.tracking_number ||
    first?.trackingNumber ||
    first?.tracking_number_provider ||
    first?.tracking ||
    "";
  const tracking_url =
    first?.tracking_url ||
    first?.trackingUrl ||
    first?.tracking_link ||
    first?.label_url ||
    first?.labelUrl ||
    first?.label ||
    "";
  await updateOrderShipping(orderId, {
    shipment_id,
    tracking_number,
    tracking_url,
    shipping_status: first?.status || first?.shipment_status || "",
    notesAppend: tracking_url ? `Envia label/tracking: ${tracking_url}` : "",
  });
  return { ok: true, shipment_id, tracking_number, tracking_url };
}

// Crear una orden en la hoja (similar a ordersRoutes) y devolver order_id
async function createOrder(payload = {}) {
  const { name, email, phone, total, items, notes, cp, pais, address = {}, pickup } = payload;
  if (!email || !items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Faltan email o items");
  }
  const doc = await getDoc();
  const sheet = await ensureOrderSheet(doc);
  const orderId = `ORD-${Date.now()}`;
  const row = {
    order_id: orderId,
    created_at: new Date().toISOString(),
    name: name || "",
    email,
    phone: phone || "",
    address_street: address.street || "",
    address_floor: address.floor || "",
    address_city: address.city || "",
    address_state: address.state || "",
    address_country: address.country || pais || "",
    address_zip: address.zip || cp || "",
    total: Number(total || 0),
    status: "pending",
    items_json: JSON.stringify(items || []),
    notes: notes || (pickup ? "Retiro en local" : "Pedido web pendiente de confirmación"),
  };
  await sheet.addRow(row);
  return orderId;
}

router.post("/create", async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN" });
  try {
    const { order_id, items = [], email, total } = req.body || {};
    if (!order_id || !email) return res.status(400).json({ error: "Faltan order_id o email" });
    const amount = Number(total || 0);
    const shipments = buildShipments(req.body || {});
    const mpItems =
      items.length > 0
        ? items.map((i) => ({
            title: i.title || i.name || "Item",
            quantity: Number(i.quantity || i.qty || 1),
            unit_price: Number(i.unit_price || i.price || 0),
          }))
        : [
            {
              title: `Pedido ${order_id}`,
              quantity: 1,
              unit_price: amount > 0 ? amount : 1,
            },
          ];

    const payload = {
      items: mpItems,
      payer: { email },
      external_reference: order_id,
      notification_url: "https://ganchos-blistero-production.up.railway.app/api/pago/webhook",
      back_urls: {
        success: "https://reliable-medovik-c4f29e.netlify.app/checkout.html?status=success",
        failure: "https://reliable-medovik-c4f29e.netlify.app/checkout.html?status=failure",
        pending: "https://reliable-medovik-c4f29e.netlify.app/checkout.html?status=pending",
      },
      auto_return: "approved",
    };
    if (shipments) payload.shipments = shipments;

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP create pref error:", data);
      return res.status(500).json({ error: "No se pudo crear la preferencia" });
    }
    res.json({
      ok: true,
      order_id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (err) {
    console.error("Error creando preferencia:", err);
    res.status(500).json({ error: "No se pudo crear la preferencia" });
  }
});

// Endpoint unificado: crea la orden y la preferencia en un solo llamado
router.post("/checkout", async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN" });
  try {
    const { items = [], email, total } = req.body || {};
    if (!email || !items || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "Faltan email o items" });
    }
    // 1) Crear orden en Sheets
    const orderId = await createOrder(req.body || {});
    // 2) Crear preferencia
    const amount = Number(total || 0);
    const shipments = buildShipments(req.body || {});
    const mpItems =
      items.length > 0
        ? items.map((i) => ({
            title: i.title || i.name || "Item",
            quantity: Number(i.quantity || i.qty || 1),
            unit_price: Number(i.unit_price || i.price || 0),
          }))
        : [
            {
              title: `Pedido ${orderId}`,
              quantity: 1,
              unit_price: amount > 0 ? amount : 1,
            },
          ];
    const payload = {
      items: mpItems,
      payer: { email },
      external_reference: orderId,
      notification_url: "https://ganchos-blistero-production.up.railway.app/api/pago/webhook",
      back_urls: {
        success: "https://reliable-medovik-c4f29e.netlify.app/checkout.html?status=success",
        failure: "https://reliable-medovik-c4f29e.netlify.app/checkout.html?status=failure",
        pending: "https://reliable-medovik-c4f29e.netlify.app/checkout.html?status=pending",
      },
      auto_return: "approved",
    };
    if (shipments) payload.shipments = shipments;
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP create pref error:", data);
      return res.status(500).json({ error: "No se pudo crear la preferencia" });
    }
    res.json({
      ok: true,
      order_id: orderId,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (err) {
    console.error("Checkout unificado error:", err);
    res.status(500).json({ error: "No se pudo procesar el checkout" });
  }
});

router.post("/webhook", async (req, res) => {
  let paymentId = req.query.id || req.body?.data?.id || req.body?.id;
  const topic = req.query.topic || req.body?.type || req.body?.topic;
  // Si viene merchant_order, buscamos el payment id
  if (!paymentId && topic === "merchant_order") {
    const moId = req.query.id || req.body?.id;
    if (moId) {
      try {
        const moRes = await fetch(`https://api.mercadopago.com/merchant_orders/${moId}`, {
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        });
        const mo = await moRes.json();
        if (Array.isArray(mo.payments) && mo.payments.length) {
          paymentId = mo.payments[0].id;
        }
      } catch (e) {
        console.error("Error leyendo merchant_order", e);
      }
    }
  }
  if (!paymentId) return res.sendStatus(400);
  if (topic && topic !== "payment" && topic !== "merchant_order") return res.sendStatus(200);
  try {
    console.log("Webhook recibido", { paymentId, topic, query: req.query, body: req.body });
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const info = await payRes.json();
    if (!payRes.ok) {
      // Evita que un pago inexistente corte el flujo
      console.warn("MP get payment error:", info);
      return res.sendStatus(200);
    }
    const orderId = info.external_reference;
    // Unificamos con los estados usados en admin (pending/approved/cancelled)
    const status =
      info.status === "approved"
        ? "approved"
        : info.status === "rejected" || info.status_detail === "cc_rejected_other_reason"
        ? "cancelled"
        : "pending";
    const shipmentId =
      info?.shipping?.id ||
      info?.shipments?.id ||
      (info?.shipping && info.shipping?.shipments_id) ||
      (await fetchMerchantOrderShipment(info)) ||
      "";
    const extraNote = `MP payment ${paymentId} status ${info.status} detail ${info.status_detail || ""} shipment ${shipmentId || "n/a"}`;
    if (orderId) {
      await updateOrderStatus(orderId, status, extraNote);
      if (status === "approved" && ENVIA_API_KEY) {
        try {
          await createEnviaShipmentForOrder(orderId);
        } catch (e) {
          console.error("No se pudo crear guia Envia:", e?.message || e);
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200);
  }
});

// Endpoint para revalidar estado por external_reference (fallback si el webhook no llegó)
router.get("/check/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const payment = await findPaymentByExternalRef(orderId);
    if (!payment) return res.status(404).json({ error: "No se encontró pago" });
    const status =
      payment.status === "approved"
        ? "approved"
        : payment.status === "rejected" || payment.status_detail === "cc_rejected_other_reason"
        ? "cancelled"
        : "pending";
    await updateOrderStatus(orderId, status, `Sync MP search status ${payment.status}`);
    res.json({ ok: true, status, id: payment.id });
  } catch (err) {
    console.error("Error en check status:", err);
    res.status(500).json({ error: "No se pudo consultar estado" });
  }
});

// Devolver URL de etiqueta de envío (ME2) para imprimir desde admin
// Devolver URL de etiqueta de envio (ME2) para imprimir desde admin
router.get("/label/:orderId", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const { orderId } = req.params;
  try {
    const payment = await findPaymentByExternalRef(orderId);
    if (!payment) return res.status(404).json({ error: "No se encontro pago" });
    const shipmentId =
      (payment?.shipping?.id) ||
      (payment?.shipments?.id) ||
      (payment?.shipping && payment.shipping?.shipments_id) ||
      (await fetchMerchantOrderShipment(payment));
    if (!shipmentId) return res.status(404).json({ error: "No hay envio ME2 asociado" });
    const labelUrl = `${ML_API_BASE}/shipment_labels?shipment_ids=${shipmentId}&access_token=${ACCESS_TOKEN}`;

    // Si se pide formato PDF, proxy desde el backend para evitar bloqueos de políticas/CORS
    if (req.query.format === "pdf") {
      const pdfRes = await fetch(`${ML_API_BASE}/shipments/${shipmentId}/labels?response_type=pdf`, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          Accept: "application/pdf",
        },
      });
      if (!pdfRes.ok) {
        const errBody = await pdfRes.text();
        return res
          .status(pdfRes.status || 500)
          .json({ error: "No se pudo obtener la etiqueta", detail: errBody || pdfRes.statusText });
      }
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=\"label-${shipmentId}.pdf\"`);
      return res.send(buf);
    }

    res.json({ ok: true, shipment_id: shipmentId, payment_id: payment.id, url: labelUrl });
  } catch (err) {
    console.error("Error obteniendo etiqueta:", err);
    res.status(500).json({ error: "No se pudo obtener la etiqueta" });
  }
});

// Tracking de envío ME2
// Tracking de envio ME2
router.get("/tracking/:orderId", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const { orderId } = req.params;
  try {
    const payment = await findPaymentByExternalRef(orderId);
    if (!payment) return res.status(404).json({ error: "No se encontro pago" });
    const shipmentId =
      (payment?.shipping?.id) ||
      (payment?.shipments?.id) ||
      (payment?.shipping && payment.shipping?.shipments_id) ||
      (await fetchMerchantOrderShipment(payment));
    if (!shipmentId) return res.status(404).json({ error: "No hay envio ME2 asociado" });
    const fallbackUrl = `https://envios.mercadolibre.com.ar/tracking?shipment_id=${shipmentId}`;
    try {
      const shipRes = await fetch(`${ML_API_BASE}/v1/shipments/${shipmentId}`, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          Accept: "application/json",
        },
      });
      const shipment = await shipRes.json();
      if (!shipRes.ok) {
        console.error("MP shipment error:", shipment);
        return res.json({
          ok: true,
          shipment_id: shipmentId,
          tracking_number: "",
          status: "unknown",
          tracking_url: fallbackUrl,
          warning: "No se pudo obtener el tracking en ML, usando link público",
        });
      }
      const trackingUrl =
        shipment.tracking_url ||
        shipment.tracking_url_provider ||
        fallbackUrl;
      res.json({
        ok: true,
        shipment_id: shipmentId,
        tracking_number: shipment.tracking_number || shipment.tracking_number_provider || "",
        status: shipment.status || shipment.substatus || "",
        tracking_url: trackingUrl,
      });
    } catch (err) {
      console.error("Error obteniendo tracking:", err);
      return res.json({
        ok: true,
        shipment_id: shipmentId,
        tracking_number: "",
        status: "unknown",
        tracking_url: fallbackUrl,
        warning: "No se pudo obtener el tracking en ML, usando link público",
      });
    }
  } catch (err) {
    console.error("Error obteniendo tracking:", err);
    res.status(500).json({ error: "No se pudo obtener el tracking" });
  }
});

// Consultar cobertura y costo estimado de envíos antes de pagar
router.post("/shipping-options", async (req, res) => {
  try {
    if (!ENVIA_API_KEY) {
      return res.json({
        ok: false,
        options: [],
        warning: "ENVIA_API_KEY no configurado",
      });
    }
    const origin = buildEnviaOrigin();
    const destination = buildEnviaDestination(req.body || {});
    const packages = buildEnviaPackages(req.body?.items || []);
    const payload = { origin, destination, packages };
    const apiRes = await fetch(`${ENVIA_API_BASE}/rates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENVIA_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok || !Array.isArray(data)) {
      console.error("Envia rates error:", data);
      return res.json({ ok: false, options: [], warning: "No se pudo cotizar envio", detail: data });
    }
    const options = data
      .map((rate) => {
        const cost = Number(rate.totalPrice || rate.total_price || rate.price || rate.amount || 0);
        return {
          carrier: rate.carrier || rate.provider || "",
          service: rate.service || rate.serviceLevelName || "",
          days: rate.deliveryEstimate || rate.days || rate.estimated_delivery || null,
          cost,
          list_cost: cost,
        };
      })
      .filter((opt) => !Number.isNaN(opt.cost) && opt.cost >= 0);
    return res.json({ ok: true, options, origin, destination });
  } catch (err) {
    console.error("Error en shipping-options:", err);
    res.status(500).json({ error: "No se pudo calcular envio" });
  }
});

module.exports = router;



