/**
`fetchGlobalListings` – cliente mínimo contra el backend `/api/marketplace/listings` que arma la query (target/cursor/maxPages/scan) y devuelve el JSON de listados globales.

Usa VITE_BACKEND_URL como base (o http://localhost:4000). 
La función recibe un objeto opcional con target, cursor, maxPages, scan, los convierte en query params según existan y hace fetch. 
Si la respuesta no es ok, lanza un error con el texto devuelto, de lo contrario, retorna res.json(). 
Es lo que useGlobalListings usa cuando prefiere el backend para obtener los listados en lugar de escanear la blockchain.
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export async function fetchGlobalListings({
  target,
  cursor,
  maxPages,
  scan,
} = {}) {
  const params = new URLSearchParams();

  if (Number.isFinite(target)) params.set("target", target);
  if (Number.isFinite(cursor)) params.set("cursor", cursor);
  if (Number.isFinite(maxPages)) params.set("maxPages", maxPages);
  if (typeof scan === "boolean") params.set("scan", String(scan));

  const query = params.toString();
  const url = `${API_BASE}/api/marketplace/listings${query ? `?${query}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "No se pudo obtener el Marketplace Global");
  }
  return res.json();
}
