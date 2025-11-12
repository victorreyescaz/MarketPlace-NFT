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
