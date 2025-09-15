/*
Endpoint para que el frontend pueda acceder a la variable de entorno del backend PINATA_JWT
*/
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/pin-json", async (req, res) => {
  try {
    const jwt = process.env.PINATA_JWT;
    const resp = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await resp.json();
    res.status(resp.ok ? 200 : 500).json(data);
  } catch (e) {
    console.error("Pinata error:", e);
    res.status(500).json({ error: "Error subiendo a Pinata" });
  }
});

export default router;
