/*
Provider "StatusBannerContext"

Centraliza el estado global de banners de error/info y expone `showError`/`showInfo` para que la UI muestre mensajes consistentes.
 */


import { useState } from "react";
import { StatusBannerContext } from "./StatusBannerContext";

export function StatusBannerProvider({ children }) {
  const [uiError, setUiError] = useState(null); // string | null
  const [uiInfo, setUiInfo] = useState(null); // string | null

  const showError = (eOrMsg, fallback) => {
    const msg =
      typeof eOrMsg === "string" ? eOrMsg : eOrMsg?.message || fallback;
    console.error("[UI Error]", msg, eOrMsg);
    setUiError(msg);
  };

  const showInfo = (msg, autoCloseMs = 3500) => {
    setUiInfo(msg);
    if (autoCloseMs) setTimeout(() => setUiInfo(null), autoCloseMs);
  };

  const value = {
    uiError,
    setUiError,
    uiInfo,
    setUiInfo,
    showError,
    showInfo,
  };

  return (
    <StatusBannerContext.Provider value={value}>
      {children}
    </StatusBannerContext.Provider>
  );
}
