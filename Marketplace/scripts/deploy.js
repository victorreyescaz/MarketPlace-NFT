const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying contract with account:", deployer.address);

  const NFT = await ethers.getContractFactory("NFT");
  const nft = await NFT.deploy(deployer.address);

  await nft.waitForDeployment(); // Necesario en versiones nuevas de Hardhat

  console.log("✅ Contract deployed at:", await nft.getAddress());
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});

// 🚀 Deploying contract with account: 0x9d7C03bD82D60D138EFeAb6d0cD1b6898564c2fD
// ✅ Contract deployed at: 0xE23FCfA688bd1ff6d0F31bac7CD7d4965d0C285e
