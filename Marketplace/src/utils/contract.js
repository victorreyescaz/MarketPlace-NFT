import { ethers } from "ethers";
import NFT_ABI from "../abis/NFT.json";

const NFT_ADDRESS = "0xE23FCfA688bd1ff6d0F31bac7CD7d4965d0C285e";

export function getNFTContract(signer) {
  return new ethers.Contract(NFT_ADDRESS, NFT_ABI.abi, signer);
}
