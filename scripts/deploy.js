const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Desplegando contrato con la cuenta:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance del deployer (wei):", balance.toString());

  const Marketplace = await hre.ethers.getContractFactory("NFTMarketplace");
  const marketplace = await Marketplace.deploy();

  await marketplace.waitForDeployment();

  console.log("Marketplace desplegado en:", await marketplace.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error al desplegar:", error);
    process.exit(1);
  });

// Desplegando contrato con la cuenta: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// Balance del deployer (wei): 10000000000000000000000
// Marketplace desplegado en: 0x5FbDB2315678afecb367f032d93F642f64180aa3
