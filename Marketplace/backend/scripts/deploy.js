const { ethers } = require("hardhat");

async function main() {
  // Pide a Hardhat la lista de signers disponibles, el primero que encuentra sera el deployer en la red actual (Sepolia). En hardhat.config.cjs esta configurada mi wallet asi que sera el deployer
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying contract with account:", deployer.address);

  // Factory es un objeto de JS que representa la receta("plantilla") de despliegue del contrato, incluye ABI, bytecode y Signer
  const NFT = await ethers.getContractFactory("NFT");

  // Pasa el deployer.address al contstructor de NFT.sol
  const nft = await NFT.deploy(deployer.address);

  // Espera a que la tx de deploy sea minada y el contrato quede listo on-chain. Necesario waitForDeployment() en versiones nuevas de Hardhat
  await nft.waitForDeployment();

  console.log("✅ Contract deployed at:", await nft.getAddress());
}

// Ejecutamos main() y capturamos errores
main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});

// 🚀 Deploying contract with account: 0x9d7C03bD82D60D138EFeAb6d0cD1b6898564c2fD
// ✅ Contract deployed at: 0xE23FCfA688bd1ff6d0F31bac7CD7d4965d0C285e
