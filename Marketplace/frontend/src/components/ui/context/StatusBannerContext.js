/*
Provider "StatusBannerContext"

Encapsula el estado global de banners de error/info para mostrar mensajes transitorios en la UI y exponer helpers "showError/showInfo".
 */

import { createContext } from "react";

export const StatusBannerContext = createContext(null);
