/*
Hook que dispara automáticamente `loadAllListings` una sola vez cuando hay condiciones para leer el marketplace global.

Se utiliza para que cargue el marketplace global sin la necesidad de que una wallet esté conectada
 */

import { useEffect, useRef } from "react";

const AUTOLOAD_ENABLED =
  (import.meta.env.VITE_AUTOLOAD_GLOBAL ?? "true").toLowerCase() !== "false";
const READ_RPC = (import.meta.env.VITE_RPC_SEPOLIA ?? "").trim();

export function useMarketplaceAutoload({
  walletProvider,
  resetFilters,
  loadAllListings,
  allowBackend = false,
}) {
  const autoLoadRef = useRef(false);

  useEffect(() => {
    if (!AUTOLOAD_ENABLED) return;
    if (autoLoadRef.current) return;
    if (!allowBackend && !READ_RPC && !walletProvider) return;

    autoLoadRef.current = true;
    resetFilters?.();
    loadAllListings?.(true);
  }, [walletProvider, allowBackend, resetFilters, loadAllListings]);
}
