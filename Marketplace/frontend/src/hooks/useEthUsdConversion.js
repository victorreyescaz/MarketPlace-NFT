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
      const n = parseFloat(priceEth);
      setPriceUsd(Number.isFinite(n) ? (n * usdPerEth).toFixed(2) : "");
    } else if (lastEdited === "usd") {
      const n = parseFloat(priceUsd);
      setPriceEth(Number.isFinite(n) ? (n / usdPerEth).toFixed(4) : "");
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

  const reset = useCallback(
    ({ eth = "", usd = "" } = {}) => {
      setPriceEth(eth ?? "");
      setPriceUsd(usd ?? "");
      setLastEdited(null);
    },
    []
  );

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
