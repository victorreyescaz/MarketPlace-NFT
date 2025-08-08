require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: process.env.VITE_RPC_SEPOLIA,
      accounts: [process.env.VITE_PRIVATE_KEY],
    },
  },
};
