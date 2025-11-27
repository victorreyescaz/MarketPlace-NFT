/*
Hook reutilizable para conversión bidireccional ETH<->USD basado en la tasa de useEthPrice.
*/

import { useCallback, useEffect, useState } from "react";
import { useEthPrice } from "./useEthPrice";

export function useEthUsdConversion({ initialEth = "", initialUsd = "" } = {}) {
  const [priceEth, setPriceEth] = useState(initialEth ?? "");
  const [priceUsd, setPriceUsd] = useState(initialUsd ?? "");
  const [lastEdited, setLastEdited] = useState(null);

  const {
    priceUsd: usdPerEth,
    loading: priceLoading,
    error: priceError,
  } = useEthPrice();

  useEffect(() => {
    if (!usdPerEth) return;

    if (lastEdited === "eth") {
      const normalized = String(priceEth ?? "").replace(",", ".");
      const n = parseFloat(normalized);
      setPriceUsd(Number.isFinite(n) ? (n * usdPerEth).toFixed(2) : "");
    } else if (lastEdited === "usd") {
      const normalized = String(priceUsd ?? "").replace(",", ".");
      const n = parseFloat(normalized);
      setPriceEth(Number.isFinite(n) ? (n / usdPerEth).toFixed(4) : "");
    }
  }, [lastEdited, priceEth, priceUsd, usdPerEth]);

  // Si el modal arranca con un valor por defecto (ej. "0,01" ETH) y aún no se editó nada, rellenamos automáticamente la otra divisa al cargar la tasa.

  useEffect(() => {
    if (!usdPerEth || lastEdited) return;

    const hasEth = String(priceEth ?? "").trim() !== "";
    const hasUsd = String(priceUsd ?? "").trim() !== "";

    if (hasEth && !hasUsd) {
      const normalized = String(priceEth ?? "").replace(",", ".");
      const n = parseFloat(normalized);
      if (Number.isFinite(n)) {
        setPriceUsd((n * usdPerEth).toFixed(2));
      }
    } else if (!hasEth && hasUsd) {
      const normalized = String(priceUsd ?? "").replace(",", ".");
      const n = parseFloat(normalized);
      if (Number.isFinite(n)) {
        setPriceEth((n / usdPerEth).toFixed(4));
      }
    }
  }, [lastEdited, priceEth, priceUsd, usdPerEth]);

  const onChangeEth = useCallback((value) => {
    setPriceEth(value);
    setLastEdited("eth");
  }, []);

  const onChangeUsd = useCallback((value) => {
    setPriceUsd(value);
    setLastEdited("usd");
  }, []);

  const reset = useCallback(({ eth = "", usd = "" } = {}) => {
    setPriceEth(eth ?? "");
    setPriceUsd(usd ?? "");
    setLastEdited(null);
  }, []);

  return {
    priceEth,
    priceUsd,
    onChangeEth,
    onChangeUsd,
    usdPerEth,
    priceLoading,
    priceError,
    reset,
  };
}
