import React, { useState } from "react";
import {
  Button,
  VStack,
  Text,
  Heading,
  Input
} from "@chakra-ui/react";

import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/react";
import { BrowserProvider, Contract } from "ethers";
import NFT_ABI from "./abis/NFT.json";

const NFT_ADDRESS = "0x5FbDB2315678aFecb367f032d93F642f64180aa3"; // Mi contrato

function App() {
  const [tokenURI, setTokenURI] = useState("");

  const { walletProvider } = useAppKitProvider("eip155"); // "eip155" = Ethereum
  const { address, isConnected, connect } = useAppKitAccount();

  const mintNFT = async () => {
    if (!walletProvider || !tokenURI) return alert("Faltan datos");

    try {
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const contract = new Contract(NFT_ADDRESS, NFT_ABI, signer);

      const tx = await contract.mint(tokenURI);
      await tx.wait();

      alert("✅ NFT mintado con éxito");
    } catch (error) {
      console.error(error);
      alert("❌ Error al mintar NFT");
    }
  };

  return (
    <VStack spacing={5} p={10}>
      <Heading>NFT Marketplace</Heading>

      {!isConnected ? (
        <Button onClick={connect} colorScheme="teal">
          Conectar Wallet
        </Button>
      ) : (
        <Text>Conectado como: {address}</Text>
      )}

      <Input
        placeholder="tokenURI (ipfs://...)"
        value={tokenURI}
        onChange={(e) => setTokenURI(e.target.value)}
      />

      <Button
        onClick={mintNFT}
        colorScheme="blue"
        isDisabled={!isConnected || !tokenURI}
      >
        Mint NFT
      </Button>
    </VStack>
  );
}

export default App;
