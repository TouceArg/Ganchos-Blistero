const { Router } = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { GoogleAuth } = require("google-auth-library");
require("dotenv").config();

const router = Router();

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const ORDER_SHEET_NAME = process.env.ORDER_SHEET_NAME || "orders";

async function getDoc() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GS_CLIENT_EMAIL,
      private_key: process.env.GS_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
  await doc.loadInfo();
  return doc;
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
  if (!row) return false;
  row.status = status || row.status;
  if (notes) row.notes = notes;
  await row.save();
  return true;
}

router.post("/create", async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN" });
  try {
    const { order_id, items = [], email, total } = req.body || {};
    if (!order_id || !email) return res.status(400).json({ error: "Faltan order_id o email" });
    const amount = Number(total || 0);
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

router.post("/webhook", async (req, res) => {
  const paymentId = req.query.id || req.body?.data?.id || req.body?.id;
  const topic = req.query.topic || req.body?.type;
  if (!paymentId) return res.sendStatus(400);
  if (topic && topic !== "payment") return res.sendStatus(200);
  try {
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const info = await payRes.json();
    if (!payRes.ok) {
      console.error("MP get payment error:", info);
      return res.sendStatus(200);
    }
    const orderId = info.external_reference;
    const status = info.status === "approved" ? "pagado" : info.status === "rejected" ? "cancelled" : "pending";
    if (orderId) {
      await updateOrderStatus(orderId, status, `MP payment ${paymentId} status ${info.status}`);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200);
  }
});

module.exports = router;
