const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying contract with account:", deployer.address);

  const NFT = await ethers.getContractFactory("NFT");
  const nft = await NFT.deploy(deployer.address);

  await nft.waitForDeployment(); // ✅ Necesario en versiones nuevas de Hardhat

  console.log("✅ Contract deployed at:", await nft.getAddress());
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});

// 🚀 Deploying contract with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// ✅ Contract deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
