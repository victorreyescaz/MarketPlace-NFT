import { useContext } from "react";
import { StatusBannerContext } from "./StatusBannerProvider";

export function useStatusBanner() {
  const ctx = useContext(StatusBannerContext);
  if (!ctx)
    throw new Error(
      "useStatusBanner debe usarse dentro de <StatusBannerProvider>"
    );
  return ctx;
}
