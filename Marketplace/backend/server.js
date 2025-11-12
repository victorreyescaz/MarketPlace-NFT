import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import marketplaceRouter from "./routes/marketplace.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 4000;
const PINATA_JWT = process.env.PINATA_JWT?.trim();
if (!PINATA_JWT) {
  console.error("[ERR] Falta PINATA_JWT en .env");
  process.exit(1);
}

// CORS: permite Vite dev server
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/marketplace", marketplaceRouter);

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
