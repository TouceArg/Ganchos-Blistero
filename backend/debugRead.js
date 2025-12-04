const { GoogleSpreadsheet } = require("google-spreadsheet");
const { GoogleAuth } = require("google-auth-library");
require("dotenv").config();

async function test() {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GS_CLIENT_EMAIL,
        private_key: process.env.GS_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
    await doc.loadInfo();
    console.log("Título hoja:", doc.title);
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    console.log("Filas:", rows.length);
    rows.slice(0, 3).forEach(r => {
      console.log("Row", r._rowNumber, r._rawData);
    });
  } catch (err) {
    console.error("Error debug:", err);
  }
}

test();
