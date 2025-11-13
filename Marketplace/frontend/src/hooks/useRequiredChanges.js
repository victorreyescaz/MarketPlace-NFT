const CHAIN_PARAMS = {
  11155111: {
    chainId: "0xaa36a7",
    chainName: "Sepolia",
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  },
};

export async function ensureSupportedChain(
  walletProvider,
  preferred = 11155111
) {
  if (!walletProvider?.request) return false;

  const currentHex = await walletProvider.request({ method: "eth_chainId" });
  const current = Number(currentHex);

  if (CHAIN_PARAMS[current]) return true;

  const target = CHAIN_PARAMS[preferred];

  try {
    await walletProvider.request({
      method: "wallet:switchEthereumChain",
      params: [{ chainId: target.chainId }],
    });
    return true;
  } catch (err) {
    if (err.code === 4902) {
      // Error que genera cuando intentas cambiar a una red que no esta agregada en el marketplace. La añadimos a Metamask para poder interactuar con el marketplace
      await walletProvider.request({
        method: "wallet_addEthereumChain",
        params: [target],
      });
      return true;
    }
    throw err;
  }
}
