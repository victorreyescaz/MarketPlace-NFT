import { ethers } from "ethers";
import NFT_ABI from "../abis/NFT.json";

const NFT_ADDRESS = "0x5FbDB2315678aFecb367f032d93F642f64180aa3";

export function getNFTContract(signer) {
  return new ethers.Contract(NFT_ADDRESS, NFT_ABI.abi, signer);
}
