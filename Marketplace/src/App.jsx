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

/* ================= Direcciones y ABIs ================= */

const NFT_ADDRESS    = "0xe23fcfa688bd1ff6d0f31bac7cd7d4965d0c285e";// en minúsculas
const MARKET_ADDRESS = "0x47576a1704597adf6bf9268f1125388748908a2a";// en minúsculas

// Si en el JSON hay solo el array => úsalo directo; si es artifact completo => usa .abi
const NFT_IFACE    = Array.isArray(NFT_ABI) ? NFT_ABI : NFT_ABI.abi;
const MARKET_IFACE = Array.isArray(MARKET_ABI) ? MARKET_ABI : MARKET_ABI.abi;



/* ================= Helpers RPC + reintentos ================= */

const READ_RPC = import.meta.env.VITE_RPC_SEPOLIA || "";

// Paginación para RPC
const MARKET_DEPLOY_BLOCK = Number(import.meta.env.VITE_MARKET_DEPLOY_BLOCK || 0);
const BLOCK_PAGE   = 80;   // bajar si hay error 429
const PAGE_DELAY_MS = 1200;  // pausa entre páginas
const MIN_WINDOW   = 80;   // ventana mínima al reducir
const MAX_RETRIES  = 3;     // reintentos lecturas puntuales

// cuántos NFTs traer por llamada y tope de páginas internas
const GLOBAL_BATCH_TARGET = 10;  // pon 12–15 si quieres
const GLOBAL_MAX_PAGES    = 6;   // seguridad para no abusar del RPC


const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function withRetry(fn, { attempts = MAX_RETRIES, delayMs = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await sleep(delayMs * (i + 1)); }
  }
  throw lastErr;
}

let _cachedReader = null;

async function getReadProvider(walletProvider) {
  if (_cachedReader) return _cachedReader;

  if (READ_RPC) {
    const p = new JsonRpcProvider(READ_RPC);
    try {
      await p.getNetwork();          // valida que el RPC responde
      _cachedReader = p;
      return p;
    } catch (e) {
      console.warn("[getReadProvider] READ_RPC falló, usando BrowserProvider:", e?.code || e?.message || e);
    }
  }

  // Fallback: usa el provider de la wallet (Metamask) para lectura
  const browser = new BrowserProvider(walletProvider);
  _cachedReader = browser;
  return browser;
}


function isRateLimit(e) {
  const code = e?.code ?? e?.error?.code ?? e?.status;
  const msg  = (e?.message || e?.error?.message || "").toLowerCase();
  return code === 429 || code === -32005 || msg.includes("rate") || msg.includes("too many");
}

// Pide SOLO ItemListed en [from,to]; si -32005/429, reduce la ventana y reintenta
async function fetchListedRange(market, from, to, minWindow = 40) {
  let left = from, right = to;

  while (true) {
    try {
      const logs = await market.queryFilter(market.filters.ItemListed(), left, right);
      return { logs, usedFrom: left, usedTo: right };
    } catch (e) {
      const msg  = (e?.message || e?.error?.message || "").toLowerCase();
      const code = e?.code ?? e?.error?.code ?? e?.status;
      const isRate = code === 429 || code === -32005 || msg.includes("rate") || msg.includes("too many");

      const win = right - left;
      if (!isRate || win <= minWindow) throw e;

      // recorta la ventana y vuelve a intentar
      const half = Math.max(minWindow, Math.floor(win / 2));
      right = left + half;
      await sleep(400);
    }
  }
}


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

  // Marketplace Global
  const [allListings, setAllListings] = useState([]);
  const [globalCursor, setGlobalCursor] = useState({ nextTo: 0, done: false }); // control del rango de bloques
  const [loadingGlobal, setLoadingGlobal] = useState(false);


  // Modal de precio
  const [priceModal, setPriceModal] = useState({
    isOpen: false,
    mode: "list",         // "list" | "update"
    tokenId: null,
    defaultPrice: ""
  });

  // loading por NFT (mapa por tokenId)
  const [txLoading, setTxLoading] = useState({});
  const setTokenLoading = (id, v) => setTxLoading(prev => ({ ...prev, [id]: v }));


  function openListModal(tokenId) {
  setPriceModal({ isOpen: true, mode: "list", tokenId, defaultPrice: "0.01" });
  }
  function openUpdateModal(tokenId, currentPrice) {
    setPriceModal({ isOpen: true, mode: "update", tokenId, defaultPrice: String(currentPrice ?? "0.01") });
  }
  function closePriceModal() {
    setPriceModal(p => ({ ...p, isOpen: false }));
  }

async function confirmPrice(priceStr) {
  try {
    if (!priceStr || Number(priceStr) <= 0) {
      alert("Introduce un precio > 0");
      return;
    }
    const { mode, tokenId } = priceModal;
    setTokenLoading(tokenId, true);

    if (mode === "list") {
      // evita listar tu propio NFT si ya está listado
      const my = myNFTs.find(n => n.tokenId === tokenId);
      if (my?.listed) { alert("Este NFT ya está listado"); return; }
      await listToken(tokenId, priceStr);
    } else {
      await updateListing(tokenId, priceStr);
    }
    closePriceModal();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Error al confirmar precio");
  } finally {
    setTokenLoading(priceModal.tokenId, false);
  }
}

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

    // evita comprarte a ti mismo
    const me = (await (await new BrowserProvider(walletProvider)).getSigner()).address?.toLowerCase?.();
    const listing = myNFTs.find(n => n.tokenId === String(tokenId));
    if (listing && listing.owner?.toLowerCase() === me) { alert("No puedes comprar tu propio NFT"); return; }


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

  /* ================= Carga de NFTs ================= */

  const loadMyNFTs = async () => {
    if (!isConnected) return;

    setAllListings([]); // vacía el marketplace global para que solo se vean mis NFTs

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


  /*=================== Marketplace global =================== */


// Cargar Marketplace Global con paginación por bloques
const loadAllListings = async (reset = true, target = GLOBAL_BATCH_TARGET) => {
  if (loadingGlobal) return;

  try {
    setMyNFTs([]);            // ocultar “Mis NFTs” cuando abrimos el global
    setLoadingGlobal(true);

    const provider = await getReadProvider(walletProvider);
    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);
    const nft    = new Contract(NFT_ADDRESS, NFT_IFACE, provider);

    // fusionar sin duplicados por tokenId
    const base = reset ? [] : allListings;
    const map  = new Map(base.map(it => [it.tokenId, it]));

    let collected = 0;
    let pages     = 0;

    const latest = await provider.getBlockNumber();
    let to   = (reset || !globalCursor.nextTo) ? latest : globalCursor.nextTo;
    let done = false;

    while (pages < GLOBAL_MAX_PAGES && collected < target && !done) {
      const fromDesired = Math.max(MARKET_DEPLOY_BLOCK, to - BLOCK_PAGE);

      // SOLO ItemListed (tu helper con backoff)
      const { logs: listedLogs, usedFrom } =
        await fetchListedRange(market, fromDesired, to);

      let addedThisPage = 0;

      for (const log of listedLogs) {
        const { nft: nftAddr, tokenId, seller } = log.args;
        if (nftAddr.toLowerCase() !== NFT_ADDRESS) continue;  // quita si usas multi-colección
        const key = tokenId.toString();
        if (map.has(key)) continue;

        try {
          const listing = await withRetry(() => market.getListing(NFT_ADDRESS, tokenId));
          if (listing.price > 0n) { // sigue listado
            let uri = await withRetry(() => nft.tokenURI(tokenId));
            if (uri.startsWith("ipfs://")) uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
            const meta = await withRetry(() => fetch(uri).then(r => r.json()));
            let img = meta.image;
            if (img?.startsWith("ipfs://")) img = img.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");

            map.set(key, {
              tokenId: key,
              name: meta.name,
              description: meta.description,
              image: img,
              seller,
              priceEth: formatEther(listing.price),
            });
            addedThisPage++;
          }
        } catch (e) {
          console.warn("[Global] no resolví tokenId=", key, e?.message || e);
        }
      }

      collected += addedThisPage;
      done = (usedFrom <= MARKET_DEPLOY_BLOCK);
      to   = usedFrom - 1;   // movemos ventana hacia atrás
      pages++;

      if (!done && (collected < target) && pages < GLOBAL_MAX_PAGES) {
        await sleep(PAGE_DELAY_MS); // respiro para no 429
      }
    }

    setAllListings(Array.from(map.values()));
    setGlobalCursor({ nextTo: to, done });
  } catch (err) {
    console.error("loadAllListings:", err);
    alert("Error cargando Marketplace Global");
  } finally {
    setLoadingGlobal(false);
    await sleep(PAGE_DELAY_MS); // pausa cortesía entre clics
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
          <Button onClick={loadMyNFTs} isLoading={loadingNFTs} colorScheme="purple">
            Mis NFTs
          </Button>
          <Button onClick={refreshProceeds} variant="outline">Actualizar saldo</Button>
          <Button onClick={withdrawProceeds} isDisabled={Number(proceedsEth) <= 0}>
            Retirar {proceedsEth} ETH
          </Button>
          {/* Marketplace global */}
          <Button onClick={() => loadAllListings(true)}  isDisabled={loadingGlobal}>
          Marketplace Global
          </Button>
          {!globalCursor.done && (
          <Button onClick={() => loadAllListings(false)} isLoading={loadingGlobal} variant="outline">
            Cargar más
          </Button>
)}
        </HStack>
      </VStack>
    )}

    {/* Formulario de minteo */}
    <Input placeholder="Nombre del NFT" value={name} onChange={(e) => setName(e.target.value)} />
    <Textarea placeholder="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
    <HStack><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></HStack>
    <Button onClick={handleMint} colorScheme="blue" isDisabled={!isConnected || !file || !name || busy}>
      {busy ? "Procesando..." : "Mint NFT"}
    </Button>

    {/* Galería (Mis NFTs) */}
    {myNFTs.length > 0 && (
      <>
        <Divider />
        <Heading size="lg">Mis NFTs</Heading>
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
                          <Button
                            size="sm"
                            isLoading={!!txLoading[nft.tokenId]}
                            onClick={() => {
                              setTokenLoading(nft.tokenId, true);
                              cancelListing(nft.tokenId).finally(() => setTokenLoading(nft.tokenId, false));
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openUpdateModal(nft.tokenId, nft.priceEth)}
                          >
                            Cambiar precio
                          </Button>
                        </HStack>
                      ) : (
                        <Button
                          size="sm"
                          colorScheme="green"
                          isLoading={!!txLoading[nft.tokenId]}
                          onClick={() => {
                            setTokenLoading(nft.tokenId, true);
                            buyToken(nft.tokenId, nft.priceEth).finally(() => setTokenLoading(nft.tokenId, false));
                          }}
                        >
                          Comprar
                        </Button>
                      )}
                    </>
                  ) : (
                    iAmOwner && (
                      <Button
                        size="sm"
                        onClick={() => openListModal(nft.tokenId)}
                      >
                        Listar
                      </Button>
                    )
                  )}
                </Stack>
              </Box>
            );
          })}
        </SimpleGrid>
        {/* Paginación */}
        {allListings.length > 0 && !globalCursor.done && (
          <HStack justify="center" mt="4">
            <Button
              onClick={() => loadAllListings(false)}
              isLoading={loadingGlobal}
              variant="outline"
            >
              Cargar más
            </Button>
          </HStack>
        )}

        {allListings.length > 0 && globalCursor.done && (
          <Text mt="4" textAlign="center" color="gray.400">
            Has llegado al inicio del deploy. No hay más listados antiguos.
          </Text>
        )}

      </>
    )}

    {/* Marketplace Global */}
    {allListings?.length > 0 && (
      <>
        <Divider />
        <Heading size="lg">Marketplace Global</Heading>
        <SimpleGrid columns={[1, 2, 3]} spacing={5}>
          {allListings.map((nft) => (
            <Box key={`${nft.tokenId}-${nft.seller}`} borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
              <Image src={nft.image} alt={nft.name} />
              <Heading size="md" mt="2">{nft.name}</Heading>
              <Text fontSize="sm" color="gray.600">{nft.description}</Text>
              <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>
              <Text>Vendedor: {nft.seller?.slice(0, 6)}...{nft.seller?.slice(-4)}</Text>
              <Text mt="1">💰 {nft.priceEth} ETH</Text>
              <Button
                size="sm"
                colorScheme="green"
                mt="2"
                isLoading={!!txLoading[nft.tokenId]}
                onClick={() => {
                  setTokenLoading(nft.tokenId, true);
                  buyToken(nft.tokenId, nft.priceEth).finally(() => setTokenLoading(nft.tokenId, false));
                }}
              >
                Comprar
              </Button>
            </Box>
          ))}
        </SimpleGrid>
      </>
    )}

    {/* === Modal de precio inline === */}
    {priceModal?.isOpen && (
      <Box position="fixed" inset="0" bg="blackAlpha.500" display="flex" alignItems="center" justifyContent="center" zIndex={1000}>
        <Box bg="white" p="6" borderRadius="md" minW={["90vw","420px"]}>
          <Heading size="md" mb="3">{priceModal.mode === "list" ? "Listar NFT" : "Actualizar precio"}</Heading>
          <Text mb="2">Precio (ETH)</Text>
          <Input
            defaultValue={priceModal.defaultPrice}
            id="__price_input__"
            type="number"
            step="0.0001"
            min="0"
            bg="gray.700"
            color="white"
            _placeholder={{ color: "gray.400" }}
          />
          <HStack mt="4" justify="flex-end">
            <Button variant="ghost" onClick={closePriceModal}>Cancelar</Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                const val = document.getElementById("__price_input__")?.value;
                confirmPrice(val);
              }}
            >
              Confirmar
            </Button>
          </HStack>
        </Box>
      </Box>
    )}
  </VStack>
);


}

export default App;
