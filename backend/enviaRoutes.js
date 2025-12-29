const { Router } = require("express");
require("dotenv").config();

const router = Router();

const ENVIA_API_KEY = process.env.ENVIA_API_KEY || "";
const ENVIA_API_BASE = process.env.ENVIA_API_BASE || "https://api.envia.com/ship";

function buildOrigin() {
  return {
    name: process.env.ENVIA_ORIGIN_NAME || "Ganchos Blisteros",
    company: process.env.ENVIA_ORIGIN_COMPANY || "Ganchos Blisteros",
    email: process.env.ENVIA_ORIGIN_EMAIL || process.env.MAIL_USER || "",
    phone: process.env.ENVIA_ORIGIN_PHONE || "",
    street: process.env.ENVIA_ORIGIN_STREET || "",
    number: process.env.ENVIA_ORIGIN_NUMBER || "",
    district: process.env.ENVIA_ORIGIN_DISTRICT || "",
    city: process.env.ENVIA_ORIGIN_CITY || "",
    state: process.env.ENVIA_ORIGIN_STATE || "",
    country: process.env.ENVIA_ORIGIN_COUNTRY || "AR",
    postalCode: process.env.ENVIA_ORIGIN_ZIP || "",
    reference: process.env.ENVIA_ORIGIN_REF || "",
  };
}

function buildPackages(items = [], fallback = {}) {
  // Envia requiere largo/ancho/alto/peso. Usamos defaults si no vienen.
  const defaults = {
    length: Number(process.env.ENVIA_PKG_LENGTH || 12),
    width: Number(process.env.ENVIA_PKG_WIDTH || 10),
    height: Number(process.env.ENVIA_PKG_HEIGHT || 5),
    weight: Number(process.env.ENVIA_PKG_WEIGHT || 0.2), // kg
    declaredValue: Number(process.env.ENVIA_PKG_VALUE || 0),
  };
  if (!Array.isArray(items) || !items.length) {
    return [
      {
        content: "Ganchos",
        amount: 1,
        type: "box",
        length: defaults.length,
        width: defaults.width,
        height: defaults.height,
        weight: defaults.weight,
        declaredValue: defaults.declaredValue,
      },
    ];
  }
  return items.map((it) => {
    const qty = Number(it.quantity || it.qty || 1);
    const length = Number(it.length || it.length_cm || fallback.length || defaults.length);
    const width = Number(it.width || it.width_cm || fallback.width || defaults.width);
    const height = Number(it.height || it.height_cm || fallback.height || defaults.height);
    const weightKg =
      Number(it.weight_kg) ||
      (Number(it.weight_g) ? Number(it.weight_g) / 1000 : fallback.weight || defaults.weight);
    const declaredValueRaw =
      Number(it.declared_value) ||
      Number(it.price) ||
      Number(fallback.declaredValue || defaults.declaredValue);
    // Si no viene valor declarado, usamos price * qty, mínimo 1
    const declaredValue = declaredValueRaw > 0 ? declaredValueRaw : Math.max(1, Number(it.price || 0) * qty || 1);
    return {
      content: it.name || it.title || "Item",
      amount: qty,
      type: "box",
      length,
      width,
      height,
      weight: weightKg || defaults.weight,
      declaredValue,
    };
  });
}

function buildDestination(body = {}) {
  const addr = body.destination || {};
  return {
    name: addr.name || body.name || "",
    company: addr.company || body.company || "",
    email: addr.email || body.email || "",
    phone: addr.phone || body.phone || "",
    street: addr.street || body.street || "",
    number: addr.number || body.number || "",
    district: addr.district || body.district || "",
    city: addr.city || body.city || "",
    state: addr.state || body.state || "",
    country: addr.country || body.country || "AR",
    postalCode: addr.postalCode || body.cp || body.postalCode || "",
    reference: addr.reference || body.reference || "",
  };
}

// Proxy de cotización a Envia
router.post("/quote", async (req, res) => {
  if (!ENVIA_API_KEY) return res.status(500).json({ error: "Falta ENVIA_API_KEY" });
  try {
    const origin = buildOrigin();
    const destination = buildDestination(req.body || {});
    const packages = buildPackages(req.body?.items || [], req.body?.packageDefaults || {});
    // Valor declarado opcional a nivel request
    if (req.body?.declaredValue) {
      packages.forEach((p) => {
        if (!p.declaredValue || p.declaredValue < req.body.declaredValue) {
          p.declaredValue = Number(req.body.declaredValue);
        }
      });
    }
    const payload = { origin, destination, packages };

    const resp = await fetch(`${ENVIA_API_BASE}/rates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENVIA_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error("Envia quote error:", data);
      return res.status(resp.status).json({ error: "No se pudo cotizar", detail: data });
    }
    res.json({ ok: true, origin, destination, packages, rates: data });
  } catch (err) {
    console.error("Error cotizando Envia:", err);
    res.status(500).json({ error: "No se pudo cotizar envio" });
  }
});

// Proxy de generación de guía
router.post("/create", async (req, res) => {
  if (!ENVIA_API_KEY) return res.status(500).json({ error: "Falta ENVIA_API_KEY" });
  try {
    const origin = buildOrigin();
    const destination = buildDestination(req.body || {});
    const packages = buildPackages(req.body?.items || [], req.body?.packageDefaults || {});
    if (req.body?.declaredValue) {
      packages.forEach((p) => {
        if (!p.declaredValue || p.declaredValue < req.body.declaredValue) {
          p.declaredValue = Number(req.body.declaredValue);
        }
      });
    }
    // el cliente debe enviar rate_id o rate seleccionado
    const rateId = req.body?.rate_id || req.body?.rateId;
    const carrier = req.body?.carrier;
    const service = req.body?.service;

    const payload = {
      origin,
      destination,
      packages,
      labelFormat: "pdf",
    };
    if (req.body?.reference) payload.reference = req.body.reference;
    if (rateId) payload.rateId = rateId;
    if (carrier) payload.carrier = carrier;
    if (service) payload.service = service;

    const resp = await fetch(`${ENVIA_API_BASE}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENVIA_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error("Envia create error:", data);
      return res.status(resp.status).json({ error: "No se pudo crear la guia", detail: data });
    }
    res.json({ ok: true, origin, destination, packages, result: data });
  } catch (err) {
    console.error("Error creando guia Envia:", err);
    res.status(500).json({ error: "No se pudo generar la guia" });
  }
});

// Webhook de status Envia
router.post("/webhook", async (req, res) => {
  try {
    // Seguridad bÃ¡sica por header si el cliente lo configurÃ³
    const secret = process.env.ENVIA_WEBHOOK_SECRET;
    if (secret) {
      const provided =
        req.headers["x-api-key"] ||
        req.headers["x-envia-signature"] ||
        req.headers["x-signature"];
      if (!provided || String(provided) !== String(secret)) {
        return res.status(401).json({ error: "No autorizado" });
      }
    }

    const payload = req.body || {};
    const { shipment_id, tracking_number, status, substatus, tracking_url, reference } = payload;
    console.log("Webhook Envia", { shipment_id, tracking_number, status, substatus, reference });

    // Si no hay referencia, nada que hacer
    if (!reference) return res.status(200).json({ ok: true });

    // Map de estados
    const mapStatus = (s) => {
      const val = (s || "").toLowerCase();
      if (["delivered"].includes(val)) return "approved";
      if (["cancelled"].includes(val)) return "cancelled";
      if (["exception"].includes(val)) return "pending";
      return "pending";
    };

    // Actualizar hoja de orders
    try {
      const ordersRoutes = require("./ordersRoutes");
      if (typeof ordersRoutes._updateShippingFromWebhook === "function") {
        await ordersRoutes._updateShippingFromWebhook({
          reference,
          shipment_id,
          tracking_number,
          tracking_url,
          status,
          mappedStatus: mapStatus(status),
        });
      }
    } catch (e) {
      console.error("No se pudo actualizar order desde webhook:", e?.message || e);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error en webhook Envia:", err);
    res.status(500).json({ error: "error" });
  }
});

module.exports = router;
