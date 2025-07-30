const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Desplegando contrato con la cuenta:", deployer.address);

  const balance = await deployer.getBalance();
  console.log(
    "Balance del deployer:",
    hre.ethers.utils.formatEther(balance),
    "ETH"
  );

  const Marketplace = await hre.ethers.getContractFactory("NFTMarketplace");
  const marketplace = await Marketplace.deploy();

  await marketplace.deployed();

  console.log("Marketplace desplegado en:", marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
