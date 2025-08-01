import { AppKit, createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { sepolia } from "@reown/appkit/networks";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia],
  projectId,
  metadata: {
    name: "NFT Marketplace",
    description: "Marketplace de NFTs",
    url: "http://127.0.0.1:5173/",
  },
});

export default appKit;
