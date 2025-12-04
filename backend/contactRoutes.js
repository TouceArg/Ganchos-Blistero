const { Router } = require("express");
const nodemailer = require("nodemailer");

const router = Router();

// Gmail SMTP (requiere 2FA + App Password de 16 caracteres)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

router.post("/", async (req, res) => {
  const { nombre, email, tel, mensaje } = req.body || {};
  if (!nombre || !email || !tel) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  console.log("MAIL_USER:", process.env.MAIL_USER, "MAIL_PASS length:", (process.env.MAIL_PASS || "").length);
  try {
    await transporter.sendMail({
      from: `"Contacto Web" <${process.env.MAIL_USER}>`,
      replyTo: email,
      to: process.env.DEST_EMAIL || process.env.MAIL_USER,
      subject: `Consulta de ${nombre}`,
      text: `Nombre: ${nombre}\nEmail: ${email}\nTel: ${tel}\nMensaje: ${mensaje || ""}`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error enviando mail de contacto:", err);
    try {
      const fs = require("fs");
      fs.appendFileSync(
        "mail-error.log",
        `[${new Date().toISOString()}] ${err?.message || err} | MAIL_USER=${process.env.MAIL_USER || ""} | PASS_LEN=${(process.env.MAIL_PASS || "").length}\n`
      );
    } catch (_) {
      // ignore file log errors
    }
    res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

module.exports = router;
