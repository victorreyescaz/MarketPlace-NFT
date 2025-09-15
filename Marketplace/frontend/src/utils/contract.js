/* Helper para el frontend

  Centraliza todo lo necesario para interactuar con los contrados desde React sin tener que repetir codigo
  en cada componente
*/

// BrowserProvider: provider conectado a Metamask ; Contract: clase para crear instancias de contrato ; parseEther: helper conversion ETH=>WEI
import { BrowserProvider, Contract, parseEther } from "ethers";
import NFT_ABI from "../abis/NFT.json";
import MARKET_ABI from "../abis/Marketplace.json";

// Direcciones en minúsculas para evitar errores de checksum
export const NFT_ADDRESS = "0xe23fcfa688bd1ff6d0f31bac7cd7d4965d0c285e";
export const MARKET_ADDRESS =
  "0x47576A1704597adF6bF9268f1125388748908a2a".toLowerCase();

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
