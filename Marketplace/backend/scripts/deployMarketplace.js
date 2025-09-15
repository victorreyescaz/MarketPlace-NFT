const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await ethers.getContractFactory("Marketplace");
  const market = await Factory.deploy();
  await market.waitForDeployment();

  console.log("✅ Marketplace deployed at:", await market.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Deploying with: 0x9d7C03bD82D60D138EFeAb6d0cD1b6898564c2fD
// ✅ Marketplace deployed at: 0x47576A1704597adF6bF9268f1125388748908a2a
