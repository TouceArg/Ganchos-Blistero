const { Router } = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { GoogleAuth } = require("google-auth-library");
require("dotenv").config();

const router = Router();

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const ORDER_SHEET_NAME = process.env.ORDER_SHEET_NAME || "orders";
const DOC_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

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
    const combined = prev ? `${prev} | ${notes}` : notes;
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

function buildShipments(body = {}) {
  const addr = body.address || {};
  const zip = (addr.zip || body.cp || "").toString().trim();
  const pickup = !!body.pickup;
  const streetName = String(addr.street || "").trim();
  const streetNumber = Number(addr.street_number || addr.number || addr.num || 0) || 1;
  if (pickup) return null;
  if (!zip || !streetName || !streetNumber) return null;
  const city = String(addr.city || "").trim();
  const state = String(addr.state || "").trim();
  const country = String(addr.country || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];
  // Tomamos medidas/peso de cada item si viene; si no, usamos defaults según size
  let maxL = 0,
    maxW = 0,
    maxH = 0,
    totalWeightGr = 0;
  items.forEach((i) => {
    const qty = Number(i.quantity || i.qty || 1);
    const has12 = String(i.size || "").includes("12");
    const defaults = has12 ? { l: 16, w: 10, h: 6, g: 150 } : { l: 14, w: 9, h: 6, g: 120 };
    const l = Number(i.length_cm || defaults.l) || defaults.l;
    const w = Number(i.width_cm || defaults.w) || defaults.w;
    const h = Number(i.height_cm || defaults.h) || defaults.h;
    const wKg = Number(i.weight_kg) || 0;
    const wGr = Number(i.weight_g) || (wKg ? wKg * 1000 : defaults.g); // default 120-150g
    maxL = Math.max(maxL, l);
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);
    totalWeightGr += wGr * qty;
  });
  if (maxL === 0) maxL = 20;
  if (maxW === 0) maxW = 15;
  if (maxH === 0) maxH = 8;
  if (typeof totalWeightGr === "undefined" || totalWeightGr <= 0) totalWeightGr = 200;
  if (totalWeightGr < 200) totalWeightGr = 200; // minimo 200g para ME2
  const dimensions = `${maxL}x${maxW}x${maxH},${Math.round(totalWeightGr)}`;
  return {
    mode: "me2",
    local_pickup: pickup,
    receiver_address: {
      zip_code: String(zip),
      street_name: streetName || "Sin calle",
      street_number: streetNumber || 1,
      floor: addr.floor || "",
      apartment: addr.apartment || "",
      city_name: addr.city || city || "",
      state_name: addr.state || state || "",
      country_name: addr.country || body.pais || "AR",
    },
    dimensions,
  };
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
      console.error("MP get payment error:", info);
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
      "";
    const extraNote = `MP payment ${paymentId} status ${info.status} detail ${info.status_detail || ""} shipment ${shipmentId || "n/a"}`;
    if (orderId) {
      await updateOrderStatus(orderId, status, extraNote);
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
router.get("/label/:orderId", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const { orderId } = req.params;
  try {
    const payment = await findPaymentByExternalRef(orderId);
    if (!payment) return res.status(404).json({ error: "No se encontró pago" });
    const shipmentId =
      payment?.shipping?.id ||
      payment?.shipments?.id ||
      (payment?.shipping && payment.shipping?.shipments_id);
    if (!shipmentId) return res.status(404).json({ error: "No hay envío ME2 asociado" });
    const labelUrl = `https://api.mercadopago.com/shipment_labels?shipment_ids=${shipmentId}&access_token=${ACCESS_TOKEN}`;
    res.json({ ok: true, shipment_id: shipmentId, payment_id: payment.id, url: labelUrl });
  } catch (err) {
    console.error("Error obteniendo etiqueta:", err);
    res.status(500).json({ error: "No se pudo obtener la etiqueta" });
  }
});

module.exports = router;


