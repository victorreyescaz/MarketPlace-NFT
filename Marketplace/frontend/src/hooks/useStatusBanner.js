/**
Hook que expone el contexto `StatusBannerContext` y asegura que se use dentro del provider.

useContext(StatusBannerContext) para obtener { uiError, setUiError, uiInfo, setUiInfo, showError, showInfo }.

Si el contexto es undefined (no hay provider en el árbol), lanza una excepción clara para evitar usos incorrectos.

Así, cualquier componente puede consumir los banners sin pasar props manualmente, siempre que esté dentro de StatusBannerProvider
 */

import { useContext } from "react";
import { StatusBannerContext } from "../components/ui/context/StatusBannerContext";

export function useStatusBanner() {
  const ctx = useContext(StatusBannerContext);
  if (!ctx) {
    throw new Error(
      "useStatusBanner debe usarse dentro de <StatusBannerProvider>"
    );
  }
  return ctx;
}
