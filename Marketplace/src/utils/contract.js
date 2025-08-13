import { BrowserProvider, Contract, parseEther } from "ethers";
import NFT_ABI from "../abis/NFT.json";
import MARKET_ABI from "../abis/Marketplace.json";

// Direcciones en minúsculas para evitar errores de checksum
export const NFT_ADDRESS = "0xe23fcfa688bd1ff6d0f31bac7cd7d4965d0c285e";
export const MARKET_ADDRESS =
  "0x47576A1704597adF6bF9268f1125388748908a2a".toLowerCase();

// Helpers para instanciar contratos
export function getNFTContract(signerOrProvider) {
  return new Contract(NFT_ADDRESS, NFT_ABI.abi, signerOrProvider);
}

export function getMarketplaceContract(signerOrProvider) {
  return new Contract(MARKET_ADDRESS, MARKET_ABI.abi, signerOrProvider);
}

// Helper para crear provider desde wallet
export async function getProvider(walletProvider) {
  return new BrowserProvider(walletProvider);
}

// Helper para convertir ETH a wei
export function toWei(ethAmount) {
  return parseEther(String(ethAmount));
}
