/*

  Inicializa el entorno y renderiza la dApp

*/

import React from 'react'
import ReactDOM from "react-dom/client"
import App from "./App";
import { Provider } from "./components/ui/provider";
import { StatusBannerProvider } from "./components/ui/context/StatusBannerContext.jsx";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { sepolia } from "@reown/appkit/networks";

// 1. Direccion donde pega el backend
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// 2. Set the networks
const supportedNetworks = [sepolia];

// 3. Create a metadata object - optional
const metadata = {
  name: "NFT Marketplace",
  description: "NFT Marketplace",
  url: window.location.origin,
  icons: ["https://avatars.mywebsite.com/"],
};

// Obtenenmos el ProjectId del backend
async function bootstrap() {
  const res = await fetch(`${BACKEND_BASE}/api/config/appkit`);
  if (!res.ok) throw new Error("No se pudo obtener el projectId");

  const { projectId } = await res.json();
  if (!projectId) throw new Error("Backend no devolvió projectId");

  // 4. Create a AppKit instance
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: supportedNetworks,
    metadata,
    projectId,
    features: {
      analytics: true, // Optional - defaults to your Cloud configuration
    },
  });

  // React.StrictMode ayuda a detectar errores de render en desarrollo
  // Provider de chakra
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <Provider>
        <StatusBannerProvider>
          <App />
        </StatusBannerProvider>
      </Provider>
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error("No se pudo inicializar AppKit", err);
  document.getElementById("root").textContent =
    "Hubo un problema inicializando la dApp.";
});
