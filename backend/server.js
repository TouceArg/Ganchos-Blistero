// Backend sencillo para exponer el catálogo desde Google Sheets
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { GoogleAuth } = require("google-auth-library");
const contactRoutes = require("./contactRoutes");
const orderRoutes = require("./ordersRoutes");
const mpRoutes = require("./mpRoutes");
const { createClient } = require("@supabase/supabase-js");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(cors());
// Aumentamos el límite de payload para soportar imágenes base64 más pesadas desde el panel admin.
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "products";
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isAdmin = (req) => {
  if (!ADMIN_TOKEN) return true;
  const t = req.headers["x-admin-token"] || req.query.token;
  return t === ADMIN_TOKEN;
};

async function leerHoja() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GS_CLIENT_EMAIL,
      private_key: process.env.GS_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  return rows.map((r) => {
    const get = (key) => (typeof r.get === "function" ? r.get(key) : r[key]);
    return {
      id: get("id"),
      name: get("name"),
      price: Number(get("price")),
      size: get("size"),
      badge: get("badge"),
      description: get("description"),
      colors: get("colors") ? JSON.parse(get("colors")) : [],
      images: get("images") ? get("images").split(",").map((s) => s.trim()) : [],
      type: get("type") || "product",
    };
  });
}

app.get("/api/catalogo", async (_req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from(SUPABASE_TABLE).select("*");
      if (error) throw error;
      return res.json(data || []);
    }
    const data = await leerHoja(); // fallback a Google Sheet si no hay supabase
    res.json(data);
  } catch (err) {
    console.error("Error leyendo hoja:", err);
    console.error("SHEET_ID:", process.env.SHEET_ID);
    console.error("GS_CLIENT_EMAIL:", process.env.GS_CLIENT_EMAIL);
    res.status(500).json({ error: "No se pudo leer la hoja" });
  }
});

// Upload a single image to Cloudinary
app.post("/api/upload-image", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  try {
    if (!cloudinary.config().cloud_name) {
      return res.status(500).json({ error: "Cloudinary no está configurado" });
    }
    const { image, folder } = req.body;
    if (!image) return res.status(400).json({ error: "Falta la imagen (base64 o URL)" });

    const uploadRes = await cloudinary.uploader.upload(image, {
      folder: folder || "ganchos",
      overwrite: true,
    });
    res.json({
      url: uploadRes.secure_url,
      public_id: uploadRes.public_id,
      width: uploadRes.width,
      height: uploadRes.height,
      format: uploadRes.format,
    });
  } catch (err) {
    console.error("Error subiendo a Cloudinary", err);
    res.status(500).json({ error: "No se pudo subir la imagen" });
  }
});

// Crear producto en Supabase
app.post("/api/products", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  try {
    if (!supabase) return res.status(500).json({ error: "Supabase no configurado" });
    const { name, price, size, badge, description, type, images } = req.body;
    if (!name || !price || !size || !type) {
      return res.status(400).json({ error: "name, price, size y type son obligatorios" });
    }
    const payload = {
      name,
      price: Number(price),
      size,
      badge: badge || null,
      description: description || null,
      type,
      images: Array.isArray(images) ? images : images ? [images] : [],
    };
    const { data, error } = await supabase.from(SUPABASE_TABLE).insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("Error creando producto:", err);
    res.status(500).json({ error: "No se pudo crear el producto" });
  }
});

// Actualizar producto
app.patch("/api/products/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  try {
    if (!supabase) return res.status(500).json({ error: "Supabase no configurado" });
    const { id } = req.params;
    const { name, price, size, badge, description, type, images } = req.body;
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (price !== undefined) payload.price = Number(price);
    if (size !== undefined) payload.size = size;
    if (badge !== undefined) payload.badge = badge || null;
    if (description !== undefined) payload.description = description || null;
    if (type !== undefined) payload.type = type;
    if (images !== undefined) {
      payload.images = Array.isArray(images) ? images : images ? [images] : [];
    }
    const { data, error } = await supabase.from(SUPABASE_TABLE).update(payload).eq("id", id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error actualizando producto:", err);
    res.status(500).json({ error: "No se pudo actualizar el producto" });
  }
});

// Eliminar producto
app.delete("/api/products/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  try {
    if (!supabase) return res.status(500).json({ error: "Supabase no configurado" });
    const { id } = req.params;
    const { error } = await supabase.from(SUPABASE_TABLE).delete().eq("id", id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando producto:", err);
    res.status(500).json({ error: "No se pudo eliminar el producto" });
  }
});

app.use("/api/contacto", contactRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/pago", mpRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API catálogo on ${port}`));
