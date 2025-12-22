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
      const adminTo = process.env.DEST_EMAIL || "ganchosblisterosc4@gmail.com" || process.env.MAIL_USER || email;
      const fmt = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(Number(n || 0));
      const itemsHtml =
        items
          ?.map((i) => {
            const qty = i.qty || i.quantity || 1;
            const price = i.price || i.unit_price || 0;
            const line = price * qty;
            return `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.name || i.title || "Item"}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(price)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmt(line)}</td>
            </tr>`;
          })
          .join("") || "";

      const infoEnvio = `${address.street || ""} ${address.number || ""} ${address.floor || ""}<br/>${address.city || ""}, ${address.state || ""} (${address.zip || cp || ""})<br/>${pais || ""}`;

      const htmlTemplate = (isClient) => `
        <div style="font-family:Arial,sans-serif;background:#f7f7fb;padding:24px;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
            <div style="padding:20px 24px;border-bottom:1px solid #eee;background:linear-gradient(120deg,#fefefe,#f5f7ff);">
              <h2 style="margin:0;color:#111;">${isClient ? "?Gracias por tu compra!" : "Nuevo pedido recibido"}</h2>
              <p style="margin:4px 0 0;color:#555;font-size:14px;">Pedido ${orderId} ? ${new Date(payload.created_at).toLocaleString("es-AR")}</p>
            </div>
            <div style="padding:24px;">
              <h3 style="margin:0 0 12px;color:#111;">Resumen</h3>
              <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
                <thead>
                  <tr style="background:#fafafa;">
                    <th style="padding:8px 12px;text-align:left;">Producto</th>
                    <th style="padding:8px 12px;text-align:center;">Cant.</th>
                    <th style="padding:8px 12px;text-align:right;">Precio</th>
                    <th style="padding:8px 12px;text-align:right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                  <tr>
                    <td colspan="3" style="padding:12px;text-align:right;font-weight:600;">Total</td>
                    <td style="padding:12px;text-align:right;font-weight:700;font-size:15px;color:#d00;">${fmt(total)}</td>
                  </tr>
                </tbody>
              </table>

              <div style="margin-top:18px;padding:14px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
                <strong style="display:block;color:#111;">Cliente</strong>
                <div style="color:#444;font-size:13px;line-height:1.5;">
                  ${name || ""}<br/>
                  ${email}<br/>
                  Tel: ${phone || "-"}<br/>
                  Env?o: ${infoEnvio}
                </div>
              </div>

              ${
                notes
                  ? `<div style="margin-top:12px;padding:12px;border-left:4px solid #ff5252;background:#fff7f7;border-radius:8px;">
                      <strong style="color:#b40000;">Notas:</strong>
                      <div style="color:#444;font-size:13px;line-height:1.5;">${notes}</div>
                    </div>`
                  : ""
              }

              <div style="margin-top:18px;color:#666;font-size:12px;line-height:1.5;">
                ${isClient ? "En breve te confirmaremos el pago y el env?o. Si tienes dudas, respond? este mail." : "Revis? el panel admin para gestionar el pedido y el env?o."}
              </div>
            </div>
          </div>
        </div>
      `;

      const textBase = `Pedido: ${orderId}
Total: ${fmt(total)}
Cliente: ${name || ""}
Email: ${email}
Tel: ${
        phone || ""
      }
Pa?s: ${pais || ""} | CP: ${cp || ""}
Env?o: ${infoEnvio.replace(/<br\/>/g, " ")}
Notas: ${payload.notes || ""}`;

      try {
        await mailer.sendMail({
          from: `"Pedidos Ganchos Blistero" <${process.env.MAIL_USER}>`,
          to: adminTo,
          subject: `Nuevo pedido ${orderId}`,
          text: textBase,
          html: htmlTemplate(false),
        });
        await mailer.sendMail({
          from: `"Ganchos Blistero" <${process.env.MAIL_USER}>`,
          to: email,
          subject: `Recibimos tu pedido ${orderId}`,
          text: textBase,
          html: htmlTemplate(true),
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
