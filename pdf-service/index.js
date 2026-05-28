"use strict";

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { createHmac, timingSafeEqual } = require("crypto");

const PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const PORT = Number(process.env.PORT) || 3000;

if (!PDF_SERVICE_SECRET) {
  console.error("[pdf-service] PDF_SERVICE_SECRET is required");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  })
);

/**
 * Verifica token HMAC emitido por /api/pdf/token no Painel SST.
 * Formato: base64url(payload_json).<hex_hmac_sha256>
 */
function verifyToken(token) {
  if (!token || typeof token !== "string") return null;

  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;

  const payload64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", PDF_SERVICE_SECRET)
    .update(payload64)
    .digest("hex");

  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")))
      return null;
  } catch {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payload64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/render", async (req, res) => {
  const { token, html, baseUrl } = req.body ?? {};

  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "html é obrigatório" });
  }

  const origin =
    baseUrl && /^https?:\/\//.test(String(baseUrl)) ? String(baseUrl) : null;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

    // Injeta <base> para que caminhos relativos (/_next/static/css/...) resolvam
    // contra a origem da aplicação Next.js em vez de about:blank.
    const htmlWithBase = origin
      ? html.replace(/(<head[^>]*>)/i, `$1<base href="${origin}/">`)
      : html;

    await page.setContent(htmlWithBase, {
      waitUntil: "networkidle2",
      timeout: 45_000,
    });

    // Chrome aplica @media print automaticamente em page.pdf() —
    // quebras de página, show/hide e margens via CSS funcionam nativamente.
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    res.set("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error("[pdf-service] render error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "Erro ao gerar PDF" });
  } finally {
    await browser?.close().catch(() => {});
  }
});

app.listen(PORT, () =>
  console.log(`[pdf-service] listening on :${PORT}`)
);
