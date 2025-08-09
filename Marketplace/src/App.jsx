import React, { useState } from "react";
import {
  Button, VStack, Text, Heading, Input, Textarea, HStack,
  SimpleGrid, Box, Image
} from "@chakra-ui/react";

import { useAppKitProvider, useAppKitAccount, useAppKit } from "@reown/appkit/react";
import { BrowserProvider, Contract } from "ethers";
import NFT_ABI from "./abis/NFT.json";

// Para delcarar el ABI, si en el archivo NFT.json esta solo el array(como es el caso) se utilizara NFT_ABI, sino (si eta todo el archivo artifacts) usará .abi
const ABI = Array.isArray(NFT_ABI) ? NFT_ABI : NFT_ABI.abi;

// Direccion del contrato NFT.sol desplegado, en minusculas para error checksum
const NFT_ADDRESS = "0xE23FCfA688bd1ff6d0F31bac7CD7d4965d0C285e".toLowerCase();

// --- Helpers para Pinata ---
async function uploadFileToPinata(file) {
  const jwt = import.meta.env.VITE_PINATA_JWT?.trim();
  if (!jwt) throw new Error("Falta VITE_PINATA_JWT en .env");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

async function uploadJSONToPinata(json) {
  const jwt = import.meta.env.VITE_PINATA_JWT?.trim();
  if (!jwt) throw new Error("Falta VITE_PINATA_JWT en .env");
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(json)
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

function App() {
  const { walletProvider } = useAppKitProvider("eip155");
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { open } = useAppKit();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [myNFTs, setMyNFTs] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  const onPickFile = (e) => setFile(e.target.files?.[0] || null);

  // Mint NFT
  const handleMint = async () => {
    if (!isConnected) return open({ view: "Connect", namespace: "eip155" });
    if (!walletProvider) return alert("No hay wallet provider");
    if (!file || !name) return alert("Falta imagen y/o nombre");

    try {
      setBusy(true);

      // 1) Subir imagen a Pinata
      const imageURI = await uploadFileToPinata(file);

      // 2) Crear metadata y subir a Pinata
      const tokenURI = await uploadJSONToPinata({
        name,
        description: desc || "",
        image: imageURI
      });

      // 3) Mint NFT
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const contract = new Contract(NFT_ADDRESS, ABI, signer);

      const tx = await contract.mint(tokenURI);
      await tx.wait();

      alert("✅ NFT subido a IPFS y minteado con éxito");
      setName(""); setDesc(""); setFile(null);
    } catch (err) {
      console.error(err);
      alert("❌ Error: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  // Load NFTs del usuario
  const loadMyNFTs = async () => {

    // Te evita el BAD_DATA si hay red equivocada o dirección mal puesta:
    const provider = new BrowserProvider(walletProvider);
    const net = await provider.getNetwork();
    const code = await provider.getCode(NFT_ADDRESS);
    console.log("ChainId:", Number(net.chainId));     // debe ser 11155111 (Sepolia)
    console.log("Has code?:", code !== "0x");         // debe ser true
    if (code === "0x") {
      alert("La dirección no contiene contrato en esta red.");
      return;
    }

    if (!isConnected) return;
    try {
      setLoadingNFTs(true);
      const provider = new BrowserProvider(walletProvider);
      const contract = new Contract(NFT_ADDRESS, ABI, provider);

      const balance = await contract.balanceOf(address);
      const nfts = [];

      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(address, i);
        let tokenURI = await contract.tokenURI(tokenId);

        if (tokenURI.startsWith("ipfs://")) {
          tokenURI = tokenURI.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        }

        const metadata = await fetch(tokenURI).then(r => r.json());

        let imageURL = metadata.image;
        if (imageURL.startsWith("ipfs://")) {
          imageURL = imageURL.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        }

        nfts.push({
          tokenId: tokenId.toString(),
          name: metadata.name,
          description: metadata.description,
          image: imageURL
        });
      }

      setMyNFTs(nfts);
    } catch (err) {
      console.error(err);
      alert("Error cargando NFTs");
    } finally {
      setLoadingNFTs(false);
    }
  };

  return (
    <VStack spacing={6} p={10} align="stretch" maxW="900px" mx="auto">
      <Heading textAlign="center">NFT Marketplace</Heading>

      {!isConnected ? (
        <Button onClick={() => open({ view: "Connect", namespace: "eip155" })} colorScheme="teal">
          Conectar Wallet
        </Button>
      ) : (
        <Text textAlign="center">Conectado como: {address}</Text>
      )}

      {/* Formulario de minteo */}
      <Input placeholder="Nombre del NFT" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea placeholder="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <HStack><Input type="file" accept="image/*" onChange={onPickFile} /></HStack>
      <Button onClick={handleMint} colorScheme="blue" isDisabled={!isConnected || !file || !name || busy}>
        {busy ? "Procesando..." : "Subir a IPFS y Mint"}
      </Button>

      {/* Botón y galería */}
      {isConnected && (
        <Button onClick={loadMyNFTs} isLoading={loadingNFTs} colorScheme="purple">
          Ver mis NFTs
        </Button>
      )}

      {myNFTs.length > 0 && (
        <SimpleGrid columns={[1, 2, 3]} spacing={5}>
          {myNFTs.map(nft => (
            <Box key={nft.tokenId} borderWidth="1px" borderRadius="lg" overflow="hidden">
              <Image src={nft.image} alt={nft.name} />
              <Box p="4">
                <Heading size="md">{nft.name}</Heading>
                <Text fontSize="sm" color="gray.600">{nft.description}</Text>
                <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
}

export default App;
