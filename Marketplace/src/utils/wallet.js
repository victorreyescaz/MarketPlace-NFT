/*
  Helper de conexion de wallets en la dApp

  Requiere un project id
*/

import { ethers } from "ethers";
import { Web3Modal } from "@web3modal/html";

const web3Modal = new Web3Modal({
  projectId: import.meta.env.VITE_PROJECT_ID,
  themeMode: "dark",
  walletConnectVersion: 2, // Version mas reciente del protocolo
});

// Abre el modal de conexion a la wallet
export async function connectWallet() {
  const instance = await web3Modal.connect(); // Devuelve instancia de la wallet conectada (Metamask, coinbase wallet...)
  const provider = new ethers.BrowserProvider(instance); // Lee datos blockchain y obtiene signers de la wallet
  const signer = await provider.getSigner(); // Obtiene el signer del provider, representa la cuenta seleccionada de la wallet

  return { provider, signer };
}
