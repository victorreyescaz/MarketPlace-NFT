import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { sepolia } from "@reown/appkit/networks";

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia],
  projectId: import.meta.env.VITE_REOWN_PROJECT_ID,
  metadata: {
    name: "NFT Marketplace",
    description: "Marketplace de NFTs",
    url: "http://127.0.0.1:5173/",
  },
  optionalNamespaces: {
    eip155: {
      chains: ["eip155:11155111"],
      methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData"],
      events: ["accountsChanged", "chainChanged"],
      rpcMap: {
        "eip155:11155111": import.meta.env.VITE_SEPOLIA_RPC_URL,
      },
    },
  },
});

export default appKit;
