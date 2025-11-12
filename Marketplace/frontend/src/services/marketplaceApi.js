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
