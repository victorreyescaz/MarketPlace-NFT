import { useCallback, useRef, useState } from "react";
import { useStatusBanner } from "./useStatusBanner";

export function useTxLocks() {
  const { showError, showInfo } = useStatusBanner();
  const [txLoading, setTxLoading] = useState({});
  const busyRef = useRef({});
  const inFlight = useRef(new Set()); // reservado para deduplicaciones futuras

  const kBuy = useCallback((id) => `buy:${String(id)}`, []);
  const kCancel = useCallback((id) => `cancel:${String(id)}`, []);
  const kList = useCallback((id) => `list:${String(id)}`, []);
  const kUpdate = useCallback((id) => `update:${String(id)}`, []);

  const setLoading = useCallback((key, value) => {
    if (!key) return;
    setTxLoading((prev) => ({ ...prev, [key]: !!value }));
  }, []);

  const isTokenBusy = useCallback(
    (id) => {
      const suffix = `:${String(id)}`;
      if (busyRef.current[kBuy(String(id))]) return true;

      for (const key in txLoading) {
        if (key.endsWith(suffix) && txLoading[key]) return true;
      }
      return false;
    },
    [kBuy, txLoading]
  );

  const runWithLock = useCallback(
    async (keyIn, event, fn) => {
      const key = String(keyIn ?? "");
      const btn = event?.currentTarget;

      try {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (busyRef.current[key]) {
          btn?.blur?.();
          console.info("[lock] ignored (already busy):", key);
          return false;
        }

        busyRef.current[key] = true;
        if (btn) btn.disabled = true;
        setLoading(key, true);

        console.info("[lock] start:", key);
        await fn();
        console.info("[lock] done:", key);
        return true;
      } catch (e) {
        const code = e?.code ?? e?.error?.code;
        const msg = (e?.message || e?.error?.message || "").toLowerCase();
        console.warn("[lock] error:", key, code, msg);

        if (code === 4001 || msg.includes("user rejected")) {
          showInfo("Operación cancelada por el usuario");
        } else {
          showError(e, "Ha fallado la operación");
        }
        return false;
      } finally {
        setLoading(key, false);
        busyRef.current[key] = false;
        if (btn) btn.disabled = false;
        btn?.blur?.();
        console.info("[lock] release:", key);
      }
    },
    [setLoading, showError, showInfo]
  );

  return {
    txLoading,
    setLoading,
    kBuy,
    kCancel,
    kList,
    kUpdate,
    isTokenBusy,
    runWithLock,
    inFlight, // mantenido por si se requiere fuera
  };
}
