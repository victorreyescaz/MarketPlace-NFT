import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import marketplaceRouter from "./routes/marketplace.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 4000;
const ETH_PRICE_CACHE_MS = Number(process.env.ETH_PRICE_CACHE_MS || 60000);
const PINATA_JWT = process.env.PINATA_JWT?.trim();
if (!PINATA_JWT) {
  console.error("[ERR] Falta PINATA_JWT en .env");
  process.exit(1);
}

const APPKIT_PROJECT_ID = process.env.APPKIT_PROJECT_ID?.trim();

const COINGECKO_ETH_PRICE =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
let cachedEthPrice = null;
let cachedEthPriceAt = 0;

// Añadir dominios de Vercel a origin
const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (o, cb) => cb(null, !o || allowed.includes(o)),
    credentials: true,
  })
);

// CORS: permite Vite dev server
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/config/appkit", (_req, res) => {
  if (!APPKIT_PROJECT_ID) {
    return res.status(500).json({ error: "Appkit Project ID no configurado" });
  }
  res.json({ projectId: APPKIT_PROJECT_ID });
});

app.use("/api/marketplace", marketplaceRouter);

// Proxy simple para precio ETH USD
app.get("/api/prices/eth", async (_req, res) => {
  try {
    const now = Date.now();
    if (
      cachedEthPrice &&
      cachedEthPriceAt &&
      now - cachedEthPriceAt < ETH_PRICE_CACHE_MS
    ) {
      return res.json(cachedEthPrice);
    }

    const cgRes = await fetch(COINGECKO_ETH_PRICE);
    if (!cgRes.ok) {
      const text = await cgRes.text().catch(() => "");
      return res.status(cgRes.status).json({
        error: "No se pudo obtener el precio del ETH",
        details: text || undefined,
      });
    }

    const payload = await cgRes.json();
    const usd = Number(payload?.ethereum?.usd);
    if (!Number.isFinite(usd)) {
      return res
        .status(502)
        .json({ error: "Respuesta inválida del proveedor de precios" });
    }

    const response = {
      usd,
      source: "coingecko",
      updatedAt: new Date().toISOString(),
    };

    cachedEthPrice = response;
    cachedEthPriceAt = now;

    return res.json(response);
  } catch (err) {
    console.error("[eth-price]", err);
    return res
      .status(500)
      .json({ error: err?.message || "Fallo al obtener precio del ETH" });
  }
});

// Sube archivo a Pinata
app.post("/api/pin/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const form = new FormData();
    form.append("file", new Blob([req.file.buffer]), req.file.originalname);

    const pinRes = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: form,
      }
    );

    if (!pinRes.ok) {
      const text = await pinRes.text();
      return res.status(pinRes.status).send(text);
    }

    const data = await pinRes.json();
    res.json(data); // { IpfsHash, PinSize, Timestamp, ... }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Upload failed" });
  }
});

// Sube JSON a Pinata
app.use(express.json({ limit: "2mb" }));
app.post("/api/pin/json", async (req, res) => {
  try {
    const pinRes = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      }
    );

    if (!pinRes.ok) {
      const text = await pinRes.text();
      return res.status(pinRes.status).send(text);
    }
    const data = await pinRes.json();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Upload failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
