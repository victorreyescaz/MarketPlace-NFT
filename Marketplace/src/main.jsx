import React from 'react'
import ReactDOM from "react-dom/client"
import App from "./App";
import { Provider } from './components/ui/provider'

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { sepolia, mainnet } from "@reown/appkit/networks";


// 1. Get projectId
const projectId = import.meta.env.VITE_PROJECT_ID;

// 2. Set the networks
const networks = [sepolia, mainnet];

// 3. Create a metadata object - optional
const metadata = {
  name: "NFT Marketplace",
  description: "NFT Marketplace",
  url: "http://127.0.0.1:5173", // origin must match your domain & subdomain
  icons: ["https://avatars.mywebsite.com/"],
};

// 4. Create a AppKit instance
createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
  },
});



ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider>
    <App/>
    </Provider>
  </React.StrictMode>,
)