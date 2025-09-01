import React, { useState, useRef } from "react";

import {
Button, VStack, Text, Heading, Input, Textarea, HStack,
SimpleGrid, Box, Image, Stack
} from "@chakra-ui/react";

import { Skeleton, SkeletonText, Spinner } from "@chakra-ui/react";

import { useAppKitProvider, useAppKitAccount, useAppKit } from "@reown/appkit/react";
import { BrowserProvider, JsonRpcProvider, Contract, parseEther, formatEther } from "ethers";

import NFT_ABI from "./abis/NFT.json";
import MARKET_ABI from "./abis/Marketplace.json";


// Sustituto del Divider ya que tenemos problemas para importarlo

const DividerLine = (props) => (
  <Box as="hr" borderTopWidth="1px" borderColor="whiteAlpha.300" my="4" {...props} />
);

/* ================= Direcciones y ABIs ================= */

const NFT_ADDRESS    = "0xe23fcfa688bd1ff6d0f31bac7cd7d4965d0c285e";// en minúsculas para evitar error checksum
const MARKET_ADDRESS = "0x47576a1704597adf6bf9268f1125388748908a2a";// en minúsculas para evitar error checksum

// Si en el JSON hay solo el array => úsalo directo; si es artifact completo => usa .abi
const NFT_IFACE = Array.isArray(NFT_ABI) ? NFT_ABI : NFT_ABI.abi;
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
const GLOBAL_BATCH_TARGET = 10;  // Nfts que se cargan por pagina
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
      await p.getNetwork();// valida que el RPC responde
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

/* === Funcion para que aparezcan todos los NFTs listados en el MarketPlace Global sin importar el tiempo que haya pasado, al ir por bloques tendremos que ir cargando mas paginas de NFts hasta llegar a los bloques donde se mintearon estos === */

// Escaneo on-chain: recorre hasta `maxScan` tokens y añade los que estén listados hoy
async function scanCollectionListings(nft, market, maxScan = 200) {
  const items = [];
  try {
    const total = Number(await withRetry(() => nft.totalSupply()));
    const count = Math.min(total, maxScan);

    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await withRetry(() => nft.tokenByIndex(i));
        const listing = await withRetry(() => market.getListing(NFT_ADDRESS, tokenId));
        if (listing.price > 0n) {
          let uri = await withRetry(() => nft.tokenURI(tokenId));
          if (uri.startsWith("ipfs://")) uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
          const meta = await withRetry(() => fetch(uri).then(r => r.json()));
          let img = meta.image;
          if (img?.startsWith("ipfs://")) img = img.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
          items.push({
            tokenId: tokenId.toString(),
            name: meta.name,
            description: meta.description,
            image: img,
            seller: listing.seller,
            priceEth: formatEther(listing.price),
            blockNumber: 0 // no lo conocemos aquí; lo rellenarán los eventos si aparece
          });
        }
      } catch (e) {
        console.warn("[scan] index", i, "falló:", e?.message || e);
      }
    }
  } catch (e) {
    console.warn("[scan] totalSupply/tokenByIndex no disponible:", e?.message || e);
  }
  return items;
}


// ======== Helpers loadAllListings ========

const makeKey = (it) => `${it.tokenId}-${(it.seller || "").toLowerCase()}`;

function sortListings(a, b) {
  const ba = a.blockNumber ?? 0, bb = b.blockNumber ?? 0;
  if (bb !== ba) return bb - ba;
  return Number(b.tokenId || 0) - Number(a.tokenId || 0);
}

// fusión incremental en estado
function mergeBatchIntoState(batch) {
  if (!batch?.length) return;
  setAllListings(prev => {
    const map = new Map(prev.map(x => [makeKey(x), x]));
    for (const it of batch) map.set(makeKey(it), it);
    return Array.from(map.values()).sort(sortListings);
  });
}

// ========= Helper indicadores de carga, mientras se cargan los nfts =========

const GLOBAL_SKELETON_COUNT = 6; // nº de tarjetas esqueleto en la primera carga

// Card “placeholder” para una NFT
function NFTCardSkeleton() {
  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
      <Skeleton height="220px" />
      <Box mt="3">
        <Skeleton height="20px" width="70%" />
        <SkeletonText mt="2" noOfLines={2} spacing="2" />
        <Skeleton mt="2" height="14px" width="40%" />
        <Skeleton mt="3" height="32px" width="90px" />
      </Box>
    </Box>
  );
}

// Grid de skeletons para mantener el layout
function SkeletonGrid({ count = 6 }) {
  return (
    <SimpleGrid columns={[1, 2, 3]} spacing={5}>
      {Array.from({ length: count }).map((_, i) => (
        <NFTCardSkeleton key={i} />
      ))}
    </SimpleGrid>
  );
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
    defaultPrice: "",
    name: "",
  });

  // loading por NFT (mapa por tokenId)
  const [txLoading, setTxLoading] = useState({}); // { [key: string]: boolean }

  // Helpers de clave
  const kBuy    = (id) => `buy:${String(id)}`;
  const kCancel = (id) => `cancel:${id}`;
  const kList   = (id) => `list:${id}`;
  const kUpdate = (id) => `update:${id}`;

  // Setter genérico
  function setLoading(key, value) {
    setTxLoading(prev => ({ ...prev, [key]: !!value }));
  }

  // ¿Algún botón de este token está ocupado?
  function isTokenBusy(id) {
    const suffix = `:${String(id)}`;
    if (busyRef.current[kBuy(String(id))]) return true; // ← refleja el lock inmediato
    
    for (const k in txLoading) {
      if (k.endsWith(suffix) && txLoading[k]) return true;
    }
    return false;
  }

  // Normalizar la clave, por si el tokenId viene como BigInt/number/string
  const keyFor = (id) => `buy:${String(id)}`;

  // Candado inmediato
  const busyRef = useRef({});

  // 
  const inFlight = React.useRef(new Set()); // Set<string>

  // Wrapper genérico para clicks con lock + loading por clave

const runWithLock = async (keyIn, event, fn) => {
  const key = String(keyIn ?? "");
  const btn = event?.currentTarget;

  try {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    // si ya hay operación en curso para este key, ignorar
    if (busyRef.current[key]) {
      btn?.blur?.();
      console.info("[lock] ignored (already busy):", key);
      return false;
    }

    // bloqueo instantáneo (DOM) + estado de loading
    busyRef.current[key] = true;
    if (btn) btn.disabled = true;           // ⬅️ bloqueo inmediato del botón
    setLoading(key, true);

    console.info("[lock] start:", key);
    await fn(); // aquí se abre MetaMask y esperamos
    console.info("[lock] done:", key);
    return true;

  } catch (e) {
    const code = e?.code ?? e?.error?.code;
    const msg  = (e?.message || e?.error?.message || "").toLowerCase();
    console.warn("[lock] error:", key, code, msg);

    if (code === 4001 || msg.includes("user rejected")) {
      showInfo("Operación cancelada por el usuario");
    } else {
      showError(e, "Ha fallado la operación");
    }
    return false;

  } finally {
    // liberar SIEMPRE
    setLoading(key, false);
    busyRef.current[key] = false;
    if (btn) btn.disabled = false;          // ⬅️ re-habilitar al cancelar/fallar/terminar
    btn?.blur?.();
    console.info("[lock] release:", key);
  }
};


  // Controles de filtro/ordenación del Marketplace Global
  const [q, setQ] = useState("");            // búsqueda (nombre/desc/token/seller)
  const [minP, setMinP] = useState("");      // precio mínimo (ETH)
  const [maxP, setMaxP] = useState("");      // precio máximo (ETH)
  const [sort, setSort] = useState("recent"); // recent | price-asc | price-desc

  //   ===== Feedback visible de errores para el usuario ===== 

      // Mensajes UX
    const [uiError, setUiError] = useState(null);   // string | null
    const [uiInfo,  setUiInfo]  = useState(null);   // string | null


  // loading por tokenId (compra)
  const [txLoadingBuy, setTxLoadingBuy] = useState({}); // { [tokenId: string]: boolean }

  function setTokenLoadingBuy(tokenId, value) {
    setTxLoadingBuy(prev => ({ ...prev, [String(tokenId)]: !!value }));
}


    // Normaliza/extrae motivo de un error de fetch/ethers
    function errMsg(e, fallback = "Ha ocurrido un error") {
      return (
        e?.shortMessage ||
        e?.reason ||
        e?.info?.error?.message ||
        e?.error?.message ||
        e?.message ||
        fallback
      );
    }

    // Helpers para mostrar mensajes
    function showError(eOrMsg, fallback) {
      const msg = typeof eOrMsg === "string" ? eOrMsg : errMsg(eOrMsg, fallback);
      console.error("[UI Error]", msg, eOrMsg);
      setUiError(msg);
    }
    function showInfo(message, autoCloseMs = 3500) {
      setUiInfo(message);
      if (autoCloseMs) setTimeout(() => setUiInfo(null), autoCloseMs);
    }


    // Activa/desactiva autoload desde .env si quieres (por defecto: ON)
    const AUTOLOAD_GLOBAL =
      (import.meta.env.VITE_AUTOLOAD_GLOBAL ?? "true").toLowerCase() !== "false";

    // Evita doble ejecución en StrictMode
    const autoLoadRef = React.useRef(false);

    React.useEffect(() => {
    if (!AUTOLOAD_GLOBAL) return;

    // Si ya hicimos el autoload, no repetir (StrictMode provoca doble render en dev)
    if (autoLoadRef.current) return;

    // Si no tienes READ_RPC y aún no hay walletProvider, espera a que exista
    // (con READ_RPC tu getReadProvider ya trabaja sin wallet conectada)
    if (!READ_RPC && !walletProvider) return;

    autoLoadRef.current = true;

    // Reset de filtros y orden al abrir
    setQ("");
    setMinP("");
    setMaxP("");
    setSort("recent");

    // Carga inicial del marketplace
    loadAllListings(true);
  }, [walletProvider]); // se disparará cuando haya provider disponible



    // -----------------------------------------------------------------------

  function openListModal(tokenId, name) {
  const fallbackName = myNFTs.find(n=>n.tokenId === String(tokenId))?.name || "";
  setPriceModal({ isOpen: true, mode: "list", tokenId, defaultPrice: "0.01", name: name ?? fallbackName });
  }
  function openUpdateModal(tokenId, currentPrice, name) {
    const fallbackName = myNFTs.find(n=>n.tokenId === String(tokenId))?.name || "";
    setPriceModal({ isOpen: true, mode: "update", tokenId, defaultPrice: String(currentPrice ?? "0.01"), name: name ?? fallbackName });
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
      const key = mode === "list" ? kList(tokenId) : kUpdate(tokenId);

      setLoading(key, true);

      if (mode === "list") {
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
      const { mode, tokenId } = priceModal;
      const key = mode === "list" ? kList(tokenId) : kUpdate(tokenId);
      setLoading(key, false);
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


async function buyToken(tokenId, priceEth, sellerFromCard) {
  try {
    if (!walletProvider) { showError("Conecta tu wallet"); return; }

    const me = (address || "").toLowerCase();
    if (sellerFromCard && sellerFromCard.toLowerCase() === me) {
      showError("No puedes comprar tu propio NFT");
      return;
    }

    const readProv = await getReadProvider(walletProvider);
    const marketR  = new Contract(MARKET_ADDRESS, MARKET_IFACE, readProv);
    const listing  = await marketR.getListing(NFT_ADDRESS, tokenId);
    const seller   = (listing.seller || "").toLowerCase();

    if (listing.price === 0n) { showError("Este NFT ya no está listado."); return; }
    if (seller === me)        { showError("No puedes comprar tu propio NFT"); return; }

    const value   = listing.price;
    const signer  = await getSigner();
    const marketW = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);

    showInfo("Simulando compra…");
    await marketW.buyItem.staticCall(NFT_ADDRESS, tokenId, { value });

    const gas = await marketW.buyItem.estimateGas(NFT_ADDRESS, tokenId, { value });
    const gasLimit = (gas * 120n) / 100n;

    showInfo("Enviando transacción…");
    const tx = await marketW.buyItem(NFT_ADDRESS, tokenId, { value, gasLimit });

    showInfo("Procesando en la red…");
    await tx.wait();

    showInfo("✅ NFT comprado", 3000);
    await loadMyNFTs();
  } catch (err) {
    showError(err, "❌ Error al comprar");
  }
}



// ==================================================================================================

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
  if (!walletProvider) return showError("No hay wallet provider");
  if (!file || !name)   return showError("Falta imagen y/o nombre");

  try {
    setBusy(true);
    showInfo("Subiendo a IPFS...");
    const imageURI = await uploadFileToPinata(file);

    showInfo("Creando metadata...");
    const tokenURI = await uploadJSONToPinata({
      name, description: desc || "", image: imageURI
    });

    showInfo("Firmando transacción de mint...");
    const provider = new BrowserProvider(walletProvider);
    const signer   = await provider.getSigner();
    const contract = new Contract(NFT_ADDRESS, NFT_IFACE, signer);

    const tx = await contract.mint(tokenURI);
    await tx.wait();

    showInfo("✅ NFT minteado con éxito");
    setName(""); setDesc(""); setFile(null);
  } catch (e) {
    showError(e, "No se pudo mintear el NFT");
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
      showError(error, "Error cargando tus NFTs");
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
    const market   = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);
    const nft      = new Contract(NFT_ADDRESS, NFT_IFACE, provider);

    // --- semilla del map con el estado actual (no perder lo que ya hay pintado) ---
    const map = new Map((reset ? [] : allListings).map(it => [makeKey(it), it]));

    // --- WARM START: si reset, poblar con estado on-chain actual y pintar ya ---
    if (reset) {
      const scanned = await scanCollectionListings(nft, market, /*maxScan*/ 200);
      if (scanned.length > 0) {
        for (const s of scanned) map.set(makeKey(s), { ...s, blockNumber: s.blockNumber ?? 0 });
        // pinta inmediatamente lo escaneado
        setAllListings(Array.from(map.values()).sort(sortListings));
      } else {
        showInfo("Escaneando listado actual…");
      }
    }

    let collected = 0;
    let pages     = 0;

    const latest = await provider.getBlockNumber();
    let to   = (reset || !globalCursor.nextTo) ? latest : globalCursor.nextTo;
    let done = false;

    while (pages < GLOBAL_MAX_PAGES && collected < target && !done) {
      // ventana inclusiva: to, to-1, ..., from
      const fromDesired = Math.max(MARKET_DEPLOY_BLOCK, to - (BLOCK_PAGE - 1));

      // SOLO ItemListed (tu helper con backoff)
      const { logs: listedLogs, usedFrom } =
        await fetchListedRange(market, fromDesired, to);

      const pageBatch = []; // items válidos de esta página
      for (const log of listedLogs) {
        const { nft: nftAddr, tokenId, seller } = log.args;
        const blockNumber = log.blockNumber;

        if (nftAddr.toLowerCase() !== NFT_ADDRESS) continue;

        // clave estable por token + seller (puede relistarse a otro seller en el futuro)
        const keyPreview = makeKey({ tokenId: tokenId.toString(), seller });
        if (map.has(keyPreview)) continue;

        try {
          const listing = await withRetry(() => market.getListing(NFT_ADDRESS, tokenId));
          if (listing.price > 0n) { // sigue listado
            let uri = await withRetry(() => nft.tokenURI(tokenId));
            if (uri.startsWith("ipfs://")) uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
            const meta = await withRetry(() => fetch(uri).then(r => r.json()));
            let img = meta.image;
            if (img?.startsWith("ipfs://")) img = img.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");

            const sellerLower = (listing.seller || seller || "").toLowerCase();
            const item = {
              tokenId: tokenId.toString(),
              name: meta.name,
              description: meta.description,
              image: img,
              seller: sellerLower,
              priceEth: formatEther(listing.price),
              blockNumber,
            };

            // añade al map y a batch (para pintar incremental)
            map.set(makeKey(item), item);
            pageBatch.push(item);
          }
        } catch (e) {
          console.warn("[Global] no resolví tokenId=", tokenId?.toString?.(), e?.message || e);
        }
      }

      // pinta incrementalmente lo reunido en esta página (evita “desapariciones”)
      if (pageBatch.length) mergeBatchIntoState(pageBatch);

      collected += pageBatch.length;
      done = (usedFrom <= MARKET_DEPLOY_BLOCK);
      to   = usedFrom - 1;   // movemos ventana hacia atrás
      pages++;

      if (!done && (collected < target) && pages < GLOBAL_MAX_PAGES) {
        await sleep(PAGE_DELAY_MS); // respiro para 429
      }
    }

    // asegurar estado final alineado con map (por si no hubo batches)
    setAllListings(Array.from(map.values()).sort(sortListings));
    setGlobalCursor({ nextTo: to, done });
  } catch (err) {
    showError(err, "Error cargando el Marketplace Global");
  } finally {
    setLoadingGlobal(false);
    await sleep(PAGE_DELAY_MS); // pausa cortesía entre clics
  }
};


/* ================= Lista derivada con filtros y ordenacion ================= */

  const filteredGlobal = React.useMemo(() => {
    let arr = Array.isArray(allListings) ? [...allListings] : [];

  // búsqueda
  const raw = q.trim();
  if (raw) {
    const digitsOnly   = /^\d+$/.test(raw);          // "6"
    const digitsFromRaw = raw.replace(/\D/g, "");    // "#6" -> "6"
    const needle = raw.toLowerCase();

    if (digitsOnly) {
      // Si es solo números, busca por tokenId exacto
      arr = arr.filter(it => String(it.tokenId ?? "") === raw);
    } else if (digitsFromRaw) {
      // Si tiene números con prefijo (#6, id:6), también filtra por tokenId
      arr = arr.filter(it => {
        const tokenStr = String(it.tokenId ?? "");
        const inId = tokenStr === digitsFromRaw;

        const inName = (it.name || "").toLowerCase().includes(needle);
        const inDesc = (it.description || "").toLowerCase().includes(needle);
        const inSeller = (it.seller || "").toLowerCase().includes(needle);

        return inId || inName || inDesc || inSeller;
      });
    } else {
      // búsqueda normal por texto
      arr = arr.filter(it => {
        const inName = (it.name || "").toLowerCase().includes(needle);
        const inDesc = (it.description || "").toLowerCase().includes(needle);
        const inSeller = (it.seller || "").toLowerCase().includes(needle);
        return inName || inDesc || inSeller;
      });
    }
  }



  // rango de precio
  const min = parseFloat(minP);
  const max = parseFloat(maxP);
  const isNum = (x) => Number.isFinite(x);

  if (isNum(min)) {
    arr = arr.filter(it => Number.parseFloat(it.priceEth ?? "0") >= min);
  }
  if (isNum(max)) {
    arr = arr.filter(it => Number.parseFloat(it.priceEth ?? "0") <= max);
  }

  // ordenación
  if (sort === "price-asc") {
    arr.sort((a,b) => Number.parseFloat(a.priceEth||"0") - Number.parseFloat(b.priceEth||"0"));
  } else if (sort === "price-desc") {
    arr.sort((a,b) => Number.parseFloat(b.priceEth||"0") - Number.parseFloat(a.priceEth||"0"));
  } else {
    // "recent": por blockNumber (mayor primero). Si no hay, cae a tokenId desc
    arr.sort((a,b) => {
      const ba = a.blockNumber ?? 0, bb = b.blockNumber ?? 0;
      if (bb !== ba) return bb - ba;
      return Number(b.tokenId||0) - Number(a.tokenId||0);
    });
  }

  return arr;
}, [allListings, q, minP, maxP, sort]);




  /* ================= Render ================= */

return (
  <VStack spacing={6} p={10} align="stretch" maxW="1000px" mx="auto">
    <Heading textAlign="center">NFT Marketplace</Heading>

        {/* Mensajes UX , feedback visible para el usuario*/}
    {uiError && (
      <Box
        borderWidth="1px"
        borderColor="red.400"
        bg="red.500"
        color="white"
        p="3"
        borderRadius="md"
      >
        <HStack justify="space-between" align="start">
          <Text fontWeight="semibold">⚠️ {uiError}</Text>
          <Button size="xs" variant="outline" onClick={() => setUiError(null)}>
            Cerrar
          </Button>
        </HStack>
      </Box>
    )}

    {uiInfo && (
      <Box
        borderWidth="1px"
        borderColor="blue.400"
        bg="blue.500"
        color="white"
        p="3"
        borderRadius="md"
      >
        <HStack justify="space-between" align="start">
          <Text>ℹ️ {uiInfo}</Text>
          <Button size="xs" variant="outline" onClick={() => setUiInfo(null)}>
            Cerrar
          </Button>
        </HStack>
      </Box>
    )}

    {/* ===================================================================================== */}


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
          <Button onClick={refreshProceeds} variant="outline">
            Actualizar saldo
            </Button>
          <Button onClick={withdrawProceeds} isDisabled={Number(proceedsEth) <= 0}>
            Retirar {proceedsEth} ETH
          </Button>

  {/* Marketplace global */}
          <Button
            colorScheme="orange"
            isDisabled={loadingGlobal}
            onClick={() => {
              // reset de filtros/orden
              setQ("");
              setMinP("");
              setMaxP("");
              setSort("recent");
              // primera carga
              loadAllListings(true);
            }}
          >
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
{/* Mis NFTs – loading → skeletons */}
{loadingNFTs && myNFTs.length === 0 && (
  <>
    <DividerLine />
    <Heading size="lg">Mis NFTs</Heading>
    <SimpleGrid columns={[1, 2, 3]} spacing={5}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
          <Skeleton height="220px" />
          <Box mt="3">
            <Skeleton height="20px" width="70%" />
            <SkeletonText mt="2" noOfLines={2} spacing="2" />
            <Skeleton mt="2" height="14px" width="40%" />
            <Skeleton mt="3" height="32px" width="90px" />
          </Box>
        </Box>
      ))}
    </SimpleGrid>
  </>
)}

{/* Mis NFTs – datos */}
{!loadingNFTs && myNFTs.length > 0 && (
  <>
    <DividerLine />
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
                  {iAmOwner && (
                    <HStack>
                      <Button
                        size="sm"
                        isLoading={!!txLoading[kCancel(nft.tokenId)]}
                        isDisabled={isTokenBusy(nft.tokenId)}
                        onClick={async () => {
                          const key = kCancel(nft.tokenId);
                          setLoading(key, true);
                          try { await cancelListing(nft.tokenId); }
                          finally { setLoading(key, false); }
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openUpdateModal(nft.tokenId, nft.priceEth, nft.name)}
                      >
                        Cambiar precio
                      </Button>
                    </HStack>
                  )}
                </>
              ) : (
                iAmOwner && (
                  <Button
                    size="sm"
                    isDisabled={isTokenBusy(nft.tokenId)}
                    onClick={() => openListModal(nft.tokenId, nft.name)}
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
  </>
)}

{/* Mis NFTs – vacío */}
{!loadingNFTs && myNFTs.length === 0 && isConnected && (
  <>
    <DividerLine />
    <Heading size="lg">Mis NFTs</Heading>
    <Box p="6" borderWidth="1px" borderRadius="md" bg="blackAlpha.200">
      <Text>No tienes NFTs (o no en esta red).</Text>
    </Box>
  </>
)}

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

    {/* Marketplace Global */}
    <DividerLine />
    <Heading size="lg">Marketplace Global</Heading>

    {/* Controles de búsqueda/filtrado/ordenación */}
    <HStack spacing={3} flexWrap="wrap" mb={4}>
      <Input
        placeholder="Buscar (nombre, descripción, tokenId, seller)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxW="360px"
      />
      <HStack>
        <Input
          placeholder="Precio min (ETH)"
          type="number"
          step="0.0001"
          value={minP}
          onChange={(e) => setMinP(e.target.value)}
          maxW="160px"
        />
        <Input
          placeholder="Precio máx (ETH)"
          type="number"
          step="0.0001"
          value={maxP}
          onChange={(e) => setMaxP(e.target.value)}
          maxW="160px"
        />
      </HStack>
      <Box as="select" value={sort} onChange={(e) => setSort(e.target.value)} maxW="220px" px={3} py={2} borderWidth="1px" borderRadius="md" bg="blackAlpha.300">
        <option value="recent">Más recientes</option>
        <option value="price-asc">Precio: menor a mayor</option>
        <option value="price-desc">Precio: mayor a menor</option>
      </Box>
      <Text fontSize="sm" color="gray.400">
        {filteredGlobal.length} resultados
      </Text>
    </HStack>

{/* Lista o estado vacío (con skeletons) */}
{loadingGlobal && filteredGlobal.length === 0 ? (
  // Primera carga: solo skeletons
  <SimpleGrid columns={[1, 2, 3]} spacing={5}>
    {Array.from({ length: GLOBAL_SKELETON_COUNT }).map((_, i) => (
      <NFTCardSkeleton key={`global-skel-${i}`} />
    ))}
  </SimpleGrid>
) : filteredGlobal.length > 0 ? (
  <>
    <SimpleGrid columns={[1, 2, 3]} spacing={5}>
      {filteredGlobal.map((nft) => {
        const me = address?.toLowerCase?.() || "";
        const cantBuy = (nft.seller || "").toLowerCase() === me; // es mi propio listado

        return (
          <Box
            key={`${nft.tokenId}-${nft.seller}`}
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            p="3"
          >
            <Image src={nft.image} alt={nft.name} />
            <Heading size="md" mt="2">{nft.name}</Heading>
            <Text fontSize="sm" color="gray.600">{nft.description}</Text>
            <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>
            <Text>
              Vendedor: {nft.seller?.slice(0, 6)}...{nft.seller?.slice(-4)}
            </Text>
            <Text mt="1">💰 {nft.priceEth} ETH</Text>

            <Button
              size="sm"
              colorScheme="green"
              mt="2"
              isLoading={!!txLoading[kBuy(nft.tokenId)]}
              isDisabled={cantBuy || isTokenBusy(nft.tokenId)}
              aria-busy={!!txLoading[kBuy(nft.tokenId)]}
              style={isTokenBusy(nft.tokenId) ? { pointerEvents: "none" } : undefined}
              title={cantBuy ? "No puedes comprar tu propio NFT" : undefined}
              onClick={(e) => {
                const key = kBuy(nft.tokenId);
                runWithLock(key, e, () =>
                  buyToken(String(nft.tokenId), nft.priceEth, nft.seller)
                );
              }}
            >
              {cantBuy ? "Tu NFT" : "Comprar"}
            </Button>
          </Box>
        );
      })}

      {/* Mientras se cargan más páginas, añade 2–3 skeletons al final para evitar “saltos” */}
      {loadingGlobal &&
        Array.from({ length: 3 }).map((_, i) => (
          <NFTCardSkeleton key={`global-skel-inline-${i}`} />
        ))}
    </SimpleGrid>

    {/* Botón de carga adicional */}
    {!globalCursor.done && (
      <Button
        onClick={() => loadAllListings(false)}
        isLoading={loadingGlobal}
        variant="outline"
        mt={4}
      >
        Cargar más
      </Button>
    )}
  </>
) : (
  // Sin resultados y sin carga
  <Box p="6" borderWidth="1px" borderRadius="md" bg="blackAlpha.200">
    <Text>No hay listados (o no coinciden con los filtros).</Text>
  </Box>
)}




    {/* === Modal de precio inline === */}
{priceModal?.isOpen && (
  <Box
    position="fixed"
    inset="0"
    bg="blackAlpha.500"
    display="flex"
    alignItems="center"
    justifyContent="center"
    zIndex={1000}
  >
    <Box bg="black" p="6" borderRadius="md" minW={["90vw","420px"]} borderWidth={"1px"} borderColor={"gray.600"} boxShadow={"lg"}>
      
      {/* 🔥 Título dinámico */}
      <Heading size="md" textAlign="center" color="white">
        {priceModal.mode === "list" ? "📌 Listar NFT" : "✏️ Actualizar precio"}
      </Heading>

      {/* Nombre del NFT debajo */}
      {priceModal.name && (
        <Text mt="1" mb="4" textAlign="center" fontWeight="semibold" color="gray.300">
          {priceModal.name}
        </Text>
      )}

      <Text mb="2">💰 Precio (ETH)</Text>
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
        <Button variant="ghost" onClick={closePriceModal}>
          Cancelar
        </Button>
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
