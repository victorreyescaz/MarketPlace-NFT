import { ethers } from "ethers";
import { Web3Modal } from "@web3modal/html";

const web3Modal = new Web3Modal({
  projectId: import.meta.env.VITE_PROJECT_ID,
  themeMode: "dark",
  walletConnectVersion: 2,
});

export async function connectWallet() {
  const instance = await web3Modal.connect();
  const provider = new ethers.BrowserProvider(instance);
  const signer = await provider.getSigner();
  return { provider, signer };
}
