// Backend sencillo para exponer el catálogo desde Google Sheets
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { GoogleAuth } = require("google-auth-library");
const contactRoutes = require("./contactRoutes");
const orderRoutes = require("./ordersRoutes");
const mpRoutes = require("./mpRoutes");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    const data = await leerHoja();
    res.json(data);
  } catch (err) {
    console.error("Error leyendo hoja:", err);
    console.error("SHEET_ID:", process.env.SHEET_ID);
    console.error("GS_CLIENT_EMAIL:", process.env.GS_CLIENT_EMAIL);
    res.status(500).json({ error: "No se pudo leer la hoja" });
  }
});

app.use("/api/contacto", contactRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/pago", mpRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API catálogo on ${port}`));
