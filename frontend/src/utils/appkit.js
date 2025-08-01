import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { sepolia } from "@reown/appkit/networks";

const projectId = process.env.REOWN_PROJECT_ID;

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia],
  projectId,
  metadata: {
    name: "NFT Marketplace",
    description: "Marketplace de NFTs",
    url: "http://localhost:5173",
  },
});
