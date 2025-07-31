const hre = require("hardhat");

async function main() {
  const [user] = await hre.ethers.getSigners();

  const marketplaceAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // NFT minteado con hash: 0x2ef9401363cd1eb5d4ead7b36c8caa59bec9db41a13fa7646089881247bb41fc
  const Marketplace = await hre.ethers.getContractFactory("NFTMarketplace");
  const marketplace = await Marketplace.attach(marketplaceAddress);

  // 👇 Este es tu tokenURI (imagen subida a IPFS con Pinata)
  const tokenURI =
    "https://gateway.pinata.cloud/ipfs/bafkreifmwk24lm6ezivxekehrqrgefyztb56mm3jajoryn5cax77h3vq64";

  const listingFee = hre.ethers.parseEther("0.01");

  // Precio del NFT
  const nftPrice = hre.ethers.parseEther("0.05");

  const tx = await marketplace.mintNFT(tokenURI, nftPrice, {
    value: listingFee,
  });

  const receipt = await tx.wait();
  console.log("NFT minteado con hash:", receipt.hash);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error al mintear:", err);
    process.exit(1);
  });
