/*
Hook para consultar la conversion ETH-USD "en vivo" a través de Coingecko
*/

import { useEffect, useMemo, useState } from "react";

const BACKEND_BASE =
  (import.meta.env.VITE_BACKEND_URL || "http://localhost:4000").replace(
    /\/$/,
    ""
  );

export function useEthPrice(refreshMs = 60000) {
  const [priceUsd, setPriceUsd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const priceEndpoint = useMemo(
    () => `${BACKEND_BASE}/api/prices/eth`,
    []
  );

  useEffect(() => {
    let alive = true;
    const fetchPrice = async () => {
      try {
        const resp = await fetch(priceEndpoint);
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(text || "No se pudo obtener el precio");
        }
        const data = await resp.json();
        const nextPrice = Number(
          data?.usd ?? data?.ethereum?.usd ?? Number.NaN
        );
        if (alive) setPriceUsd(Number.isFinite(nextPrice) ? nextPrice : null);
        if (alive) setError(null);
      } catch (err) {
        if (alive) setError(err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchPrice();
    const id = setInterval(fetchPrice, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshMs, priceEndpoint]);

  return { priceUsd, loading, error };
}
