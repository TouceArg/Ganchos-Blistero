const { Router } = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { GoogleAuth } = require("google-auth-library");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = Router();

const ORDER_SHEET_NAME = process.env.ORDER_SHEET_NAME || "orders";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const DOC_CACHE_TTL_MS = 5 * 60 * 1000; // cachea el doc 5 minutos para evitar demoras

let cachedDoc = null;
let cachedDocAt = 0;

function isAdmin(req) {
  const raw =
    req.query.token ||
    req.headers["x-admin-token"] ||
    req.headers["authorization"] ||
    "";
  const token = String(raw).trim();
  const admin = String(ADMIN_TOKEN || "").trim();
  return admin && token === admin;
}

function mapRow(row) {
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
  };
}

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

// SMTP para notificaciones de pedidos
const mailer =
  process.env.MAIL_USER && process.env.MAIL_PASS
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      })
    : null;

router.post("/", async (req, res) => {
  try {
    const { name, email, phone, total, items, notes, cp, pais, address = {} } = req.body || {};
    if (!email || !items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Faltan email o items para registrar la orden" });
    }
    const doc = await getDoc();
    const sheet = await ensureOrderSheet(doc);
    const orderId = `ORD-${Date.now()}`;
    const payload = {
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
      items_json: JSON.stringify(items),
      notes: notes || `Pais: ${pais || ""} | CP: ${cp || ""}`,
    };
    await sheet.addRow(payload);

    // Notificar por mail (cliente + admin) si hay credenciales
    if (mailer && email) {
      const adminTo = process.env.DEST_EMAIL || process.env.MAIL_USER || email;
      const itemsText =
        items
          ?.map(
            (i) =>
              `• ${i.name || i.title || "Item"} x${i.qty || i.quantity || 1} - $${i.price || i.unit_price || 0}`
          )
          .join("\n") || "";
      const baseInfo = `Pedido: ${orderId}\nTotal: $${Number(total || 0)}\nCliente: ${name || ""}\nEmail: ${email}\nTel: ${
        phone || ""
      }\nPaís: ${pais || ""} | CP: ${cp || ""}\nNotas: ${payload.notes || ""}\nItems:\n${itemsText}`;
      try {
        await mailer.sendMail({
          from: `"Pedidos Ganchos Blistero" <${process.env.MAIL_USER}>`,
          to: adminTo,
          subject: `Nuevo pedido ${orderId}`,
          text: baseInfo,
        });
        await mailer.sendMail({
          from: `"Ganchos Blistero" <${process.env.MAIL_USER}>`,
          to: email,
          subject: `Recibimos tu pedido ${orderId}`,
          text: `Gracias por tu compra.\n\n${baseInfo}\n\nTe avisaremos cuando se confirme el pago.`,
        });
      } catch (mailErr) {
        console.warn("No se pudo enviar email de pedido:", mailErr?.message || mailErr);
      }
    }

    res.json({ ok: true, order_id: orderId });
  } catch (err) {
    console.error("Error guardando orden:", err);
    res.status(500).json({ error: "No se pudo guardar la orden" });
  }
});

router.get("/", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  try {
    const doc = await getDoc();
    const sheet = await ensureOrderSheet(doc);
    const rows = await sheet.getRows();
    const data = rows.map(mapRow);
    res.json(data);
  } catch (err) {
    console.error("Error leyendo orders:", err);
    res.status(500).json({ error: "No se pudo leer orders" });
  }
});

router.patch("/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const { id } = req.params;
  const { status, notes } = req.body || {};
  try {
    const doc = await getDoc();
    const sheet = await ensureOrderSheet(doc);
    const rows = await sheet.getRows();
    const row = rows.find((r) => {
      const get = typeof r.get === "function" ? r.get.bind(r) : r;
      return (get("order_id") || get.order_id) === id;
    });
    if (!row) return res.status(404).json({ error: "Orden no encontrada" });
    if (status) row.set("status", status);
    if (typeof notes === "string") row.set("notes", notes);
    await row.save();
    res.json({ ok: true });
  } catch (err) {
    console.error("Error actualizando orden:", err);
    res.status(500).json({ error: "No se pudo actualizar la orden" });
  }
});

// Eliminar una orden
router.delete("/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const { id } = req.params;
  try {
    const doc = await getDoc();
    const sheet = await ensureOrderSheet(doc);
    const rows = await sheet.getRows();
    const row = rows.find((r) => {
      const get = typeof r.get === "function" ? r.get.bind(r) : r;
      return (get("order_id") || get.order_id) === id;
    });
    if (!row) return res.status(404).json({ error: "Orden no encontrada" });
    await row.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando orden:", err);
    res.status(500).json({ error: "No se pudo eliminar la orden" });
  }
});

module.exports = router;
