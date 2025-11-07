/* Helper para el frontend

  Centraliza todo lo necesario para interactuar con los contratos desde React sin tener que repetir codigo
  en cada componente
*/

// BrowserProvider: provider conectado a Metamask ; Contract: clase para crear instancias de contrato ; parseEther: helper conversion ETH=>WEI
import { BrowserProvider, Contract, parseEther } from "ethers";
import NFT_ABI from "../abis/NFT.json";
import MARKET_ABI from "../abis/Marketplace.json";

// Direcciones desplegadas y ABI's
export const NFT_ADDRESS = import.meta.env.VITE_NFT_ADDRESS;
export const MARKET_ADDRESS = import.meta.env.VITE_MARKET_ADDRESS;

// Para instanciar contratos en el desarrollo de la dApp.
// Si en el JSON hay solo el array => úsalo directo; si es artifact completo => usa .abi
export const NFT_IFACE = Array.isArray(NFT_ABI) ? NFT_ABI : NFT_ABI.abi;
export const MARKET_IFACE = Array.isArray(MARKET_ABI)
  ? MARKET_ABI
  : MARKET_ABI.abi;

// Helpers para instanciar contratos

// Para NFT.sol
export function getNFTContract(signerOrProvider) {
  return new Contract(NFT_ADDRESS, NFT_ABI.abi, signerOrProvider);
  // Si pasamos un provider podremos hacer view y con el signer(wallet) podremos transacciones(mint, approve)...
}

// Para Marketplace.sol
export function getMarketplaceContract(signerOrProvider) {
  return new Contract(MARKET_ADDRESS, MARKET_ABI.abi, signerOrProvider);
}

// Helper para crear provider desde wallet. Permite lecturas de blockchain y obtener el signer de la wallet conectada
export async function getProvider(walletProvider) {
  return new BrowserProvider(walletProvider);
}

// Helper para convertir ETH a wei
export function toWei(ethAmount) {
  return parseEther(String(ethAmount));
}
