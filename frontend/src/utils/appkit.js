import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { mainnet, sepolia } from "@reown/appkit/networks";

// 1. Get projectId
const projectId = "572cd4e95b82ee7e2cdd5190c46e3db0";

// 2. Set the networks
const networks = [sepolia, mainnet];

// 3. Create a metadata object - optional
const metadata = {
  name: "NFT MarketPlace",
  description: "NFT Marketplace",
  url: window.location.origin, // Para poder ejecutar en local y en Vercel sin tener problemas con la url
  icons: ["https://avatars.mywebsite.com/"],
};

// 4. Create a AppKit instance
const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
  },
});

export default appKit;
