import React, { useState } from "react";
import {
  Button, VStack, Text, Heading, Input, Textarea, HStack,
  SimpleGrid, Box, Image, Stack
} from "@chakra-ui/react";
import { Divider } from "@chakra-ui/layout";

import { useAppKitProvider, useAppKitAccount, useAppKit } from "@reown/appkit/react";
import { BrowserProvider, JsonRpcProvider, Contract, parseEther, formatEther } from "ethers";

import NFT_ABI from "./abis/NFT.json";
import MARKET_ABI from "./abis/Marketplace.json";

/* ================= Helpers RPC + reintentos ================= */

const READ_RPC = import.meta.env.VITE_RPC_SEPOLIA || ""; // p.ej. https://go.getblock.io/<KEY>/sepolia/

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function withRetry(fn, { attempts = 3, delayMs = 300 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await sleep(delayMs * (i + 1)); }
  }
  throw lastErr;
}

async function getReadProvider(walletProvider) {
  if (READ_RPC) return new JsonRpcProvider(READ_RPC);
  return new BrowserProvider(walletProvider);
}

/* ================= Direcciones y ABIs ================= */

const NFT_ADDRESS    = "0xe23fcfa688bd1ff6d0f31bac7cd7d4965d0c285e";// en minúsculas
const MARKET_ADDRESS = "0x47576a1704597adf6bf9268f1125388748908a2a";// en minúsculas

// Si en el JSON hay solo el array => úsalo directo; si es artifact completo => usa .abi
const NFT_IFACE    = Array.isArray(NFT_ABI) ? NFT_ABI : NFT_ABI.abi;
const MARKET_IFACE = Array.isArray(MARKET_ABI) ? MARKET_ABI : MARKET_ABI.abi;

/* ================= Pinata helpers ================= */

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

/* ================= Componente ================= */

function App() {
  const { walletProvider } = useAppKitProvider("eip155");
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { open } = useAppKit();

  // form mint
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  // gallery
  const [myNFTs, setMyNFTs] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  // proceeds (saldo a retirar)
  const [proceedsEth, setProceedsEth] = useState("0");

  const onPickFile = (e) => setFile(e.target.files?.[0] || null);

  /* ========= Firmas / contratos + acciones Marketplace ========= */

  const getSigner = async () => (await new BrowserProvider(walletProvider)).getSigner();

  async function ensureApprovalAll(owner) {
    const signer = await getSigner();
    const nft = new Contract(NFT_ADDRESS, NFT_IFACE, signer);

    // sanity ABI
    try {
      nft.interface.getFunction("isApprovedForAll");
      nft.interface.getFunction("setApprovalForAll");
    } catch {
      throw new Error("ABI NFT sin isApprovedForAll/setApprovalForAll");
    }

    const approved = await withRetry(() => nft.isApprovedForAll(owner, MARKET_ADDRESS));
    if (approved) return;

    await nft.setApprovalForAll.staticCall(MARKET_ADDRESS, true);
    const gas = await nft.setApprovalForAll.estimateGas(MARKET_ADDRESS, true);
    const tx  = await nft.setApprovalForAll(MARKET_ADDRESS, true, { gasLimit: (gas * 120n) / 100n });
    await tx.wait();
  }

  async function listToken(tokenId, priceEth) {
    if (!priceEth) return;
    const signer = await getSigner();
    const me = (await signer.getAddress()).toLowerCase();

    await ensureApprovalAll(me);

    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);
    try { market.interface.getFunction("listItem"); }
    catch { alert("ABI Marketplace incorrecto"); return; }

    const price = parseEther(String(priceEth));
    await market.listItem.staticCall(NFT_ADDRESS, tokenId, price);
    const gas = await market.listItem.estimateGas(NFT_ADDRESS, tokenId, price);
    const tx  = await market.listItem(NFT_ADDRESS, tokenId, price, { gasLimit: (gas * 120n) / 100n });
    await tx.wait();
    alert("✅ Listado creado");
    await loadMyNFTs();
  }

  async function updateListing(tokenId, priceEth) {
    if (!priceEth) return;
    const signer = await getSigner();
    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);
    const price = parseEther(String(priceEth));

    await market.updateListing.staticCall(NFT_ADDRESS, tokenId, price);
    const gas = await market.updateListing.estimateGas(NFT_ADDRESS, tokenId, price);
    const tx  = await market.updateListing(NFT_ADDRESS, tokenId, price, { gasLimit: (gas * 120n) / 100n });
    await tx.wait();
    alert("✅ Precio actualizado");
    await loadMyNFTs();
  }

  async function cancelListing(tokenId) {
    const signer = await getSigner();
    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);

    await market.cancelListing.staticCall(NFT_ADDRESS, tokenId);
    const gas = await market.cancelListing.estimateGas(NFT_ADDRESS, tokenId);
    const tx  = await market.cancelListing(NFT_ADDRESS, tokenId, { gasLimit: (gas * 120n) / 100n });
    await tx.wait();
    alert("✅ Listado cancelado");
    await loadMyNFTs();
  }

  async function buyToken(tokenId, priceEth) {
    const signer = await getSigner();
    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);
    const value  = parseEther(String(priceEth));

    await market.buyItem.staticCall(NFT_ADDRESS, tokenId, { value });
    const gas = await market.buyItem.estimateGas(NFT_ADDRESS, tokenId, { value });
    const tx  = await market.buyItem(NFT_ADDRESS, tokenId, { value, gasLimit: (gas * 120n) / 100n });
    await tx.wait();
    alert("✅ NFT comprado");
    await loadMyNFTs();
  }

  async function refreshProceeds() {
    try {
      const provider = await getReadProvider(walletProvider);
      const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);
      const proceeds = await withRetry(() => market.getProceeds(address));
      setProceedsEth(formatEther(proceeds));
    } catch (e) {
      console.warn("getProceeds:", e);
    }
  }

  async function withdrawProceeds() {
    const signer = await getSigner();
    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);

    await market.withdrawProceeds.staticCall();
    const gas = await market.withdrawProceeds.estimateGas();
    const tx  = await market.withdrawProceeds({ gasLimit: (gas * 120n) / 100n });
    await tx.wait();
    alert("✅ Fondos retirados");
    await refreshProceeds();
  }

  /* ================= Mint ================= */

  const handleMint = async () => {
    if (!isConnected) return open({ view: "Connect", namespace: "eip155" });
    if (!walletProvider) return alert("No hay wallet provider");
    if (!file || !name) return alert("Falta imagen y/o nombre");

    try {
      setBusy(true);

      const imageURI = await uploadFileToPinata(file);
      const tokenURI = await uploadJSONToPinata({ name, description: desc || "", image: imageURI });

      const signer = await getSigner();
      const contract = new Contract(NFT_ADDRESS, NFT_IFACE, signer);
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

  /* ================= Carga de NFTs (robusta a rate limits) ================= */

  const loadMyNFTs = async () => {
    if (!isConnected) return;

    try {
      setLoadingNFTs(true);

      // provider lectura (RPC propio si está definido)
      const provider = await getReadProvider(walletProvider);
      const nft    = new Contract(NFT_ADDRESS, NFT_IFACE, provider);
      const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);

      // sanity: red y bytecode
      const [net, codeNFT, codeMKT] = await Promise.all([
        provider.getNetwork(),
        provider.getCode(NFT_ADDRESS),
        provider.getCode(MARKET_ADDRESS),
      ]);
      console.log("ChainId:", Number(net.chainId));
      console.log("NFT has code?:", codeNFT !== "0x");
      console.log("MKT has code?:", codeMKT !== "0x");
      if (codeMKT === "0x") {
        alert("MARKET_ADDRESS no contiene contrato en esta red.");
        return;
      }

      // sanity: ABI marketplace
      try {
        market.interface.getFunction("getListing");
        market.interface.getFunction("getProceeds");
        console.log("ABI Marketplace OK");
      } catch (e) {
        console.error("ABI Marketplace desactualizado:", e);
        alert("ABI del Marketplace en src/abis/Marketplace.json no coincide con el deploy. Vuelve a copiar el array 'abi' del artifacts.");
        return;
      }

      // balance
      const balanceBN = await withRetry(() => nft.balanceOf(address));
      const balance = Number(balanceBN);
      console.log("balanceOf(address):", balance);

      if (balance === 0) {
        setMyNFTs([]);
        // proceeds aunque no haya NFTs
        try {
          const proceeds = await withRetry(() => market.getProceeds(address));
          setProceedsEth(formatEther(proceeds));
        } catch (e) {
          console.warn("getProceeds falló (sin bloquear la UI):", e);
        }
        return;
      }

      for (let i = 0; i < balance; i++) console.log("checking index:", i);

      // tokenIds: secuencial + retry (para evitar rate limits)
      const tokenIds = [];
      for (let i = 0; i < balance; i++) {
        try {
          const id = await withRetry(() => nft.tokenOfOwnerByIndex(address, i), { attempts: 4, delayMs: 250 });
          tokenIds.push(id);
        } catch (e) {
          console.warn("tokenOfOwnerByIndex failed at index", i, e);
          continue;
        }
        await sleep(120);
      }
      console.log("tokenIds resolved:", tokenIds.map(x => x.toString()));

      // construimos items (con retries)
      const items = [];
      for (const tokenIdBN of tokenIds) {
        const tokenId = tokenIdBN.toString();

        const [rawURI, owner, listing] = await Promise.all([
          withRetry(() => nft.tokenURI(tokenId)),
          withRetry(() => nft.ownerOf(tokenId)),
          withRetry(() => market.getListing(NFT_ADDRESS, tokenId)),
        ]);

        let uri = rawURI;
        if (uri.startsWith("ipfs://")) uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        const meta = await withRetry(() => fetch(uri).then(r => r.json()));

        let img = meta.image;
        if (img?.startsWith("ipfs://")) img = img.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");

        const listed   = listing.price > 0n;
        const priceEth = listed ? formatEther(listing.price) : null;

        items.push({
          tokenId,
          name: meta.name,
          description: meta.description,
          image: img,
          owner,
          listed,
          priceEth,
          seller: listing.seller
        });

        await sleep(100);
      }

      setMyNFTs(items);

      // proceeds (separado para no tumbar toda la carga)
      try {
        const proceeds = await withRetry(() => market.getProceeds(address));
        setProceedsEth(formatEther(proceeds));
      } catch (e) {
        console.warn("getProceeds falló (sin bloquear la UI):", e);
      }
    } catch (err) {
      console.error(err);
      alert("Error cargando NFTs");
    } finally {
      setLoadingNFTs(false);
    }
  };

  /* ================= Render ================= */

  return (
    <VStack spacing={6} p={10} align="stretch" maxW="1000px" mx="auto">
      <Heading textAlign="center">NFT Marketplace</Heading>

      {!isConnected ? (
        <Button onClick={() => open({ view: "Connect", namespace: "eip155" })} colorScheme="teal">
          Conectar Wallet
        </Button>
      ) : (
        <VStack>
          <Text>Conectado como: {address}</Text>
          <HStack>
            <Button onClick={loadMyNFTs} isLoading={loadingNFTs} colorScheme="purple">Ver mis NFTs</Button>
            <Button onClick={refreshProceeds} variant="outline">Actualizar saldo</Button>
            <Button onClick={withdrawProceeds} isDisabled={Number(proceedsEth) <= 0}>Retirar {proceedsEth} ETH</Button>
          </HStack>
        </VStack>
      )}

      {/* Formulario de minteo */}
      <Input placeholder="Nombre del NFT" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea placeholder="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <HStack><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></HStack>
      <Button onClick={handleMint} colorScheme="blue" isDisabled={!isConnected || !file || !name || busy}>
        {busy ? "Procesando..." : "Subir a IPFS y Mint"}
      </Button>

      {/* Galería */}
      {myNFTs.length > 0 && (
        <>
          <Divider />
          <SimpleGrid columns={[1, 2, 3]} spacing={5}>
            {myNFTs.map((nft) => {
              const iAmOwner = nft.owner?.toLowerCase() === address?.toLowerCase();

              return (
                <Box key={nft.tokenId} borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
                  <Image src={nft.image} alt={nft.name} />
                  <Heading size="md" mt="2">{nft.name}</Heading>
                  <Text fontSize="sm" color="gray.600">{nft.description}</Text>
                  <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>

                  <Stack mt="3" spacing={2}>
                    {nft.listed ? (
                      <>
                        <Text>💰 {nft.priceEth} ETH</Text>
                        {iAmOwner ? (
                          <HStack>
                            <Button size="sm" onClick={() => cancelListing(nft.tokenId)}>Cancelar</Button>
                            <Button size="sm" onClick={() => {
                              const p = prompt("Nuevo precio en ETH:", String(nft.priceEth ?? "0.01"));
                              if (p) updateListing(nft.tokenId, p);
                            }}>Cambiar precio</Button>
                          </HStack>
                        ) : (
                          <Button size="sm" colorScheme="green" onClick={() => buyToken(nft.tokenId, nft.priceEth)}>
                            Comprar
                          </Button>
                        )}
                      </>
                    ) : (
                      iAmOwner && (
                        <Button size="sm" onClick={() => {
                          const p = prompt("Precio en ETH:");
                          if (p) listToken(nft.tokenId, p);
                        }}>
                          Listar
                        </Button>
                      )
                    )}
                  </Stack>
                </Box>
              );
            })}
          </SimpleGrid>
        </>
      )}
    </VStack>
  );
}

export default App;
