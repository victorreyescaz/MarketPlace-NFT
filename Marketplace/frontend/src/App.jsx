import React, { useState, useRef, useEffect } from "react";
/*
Button: botones.

VStack/HStack: stacks verticales/horizontales con gap y alignment.

Text, Heading: tipografía.

Input, Textarea: formularios.

SimpleGrid: rejillas responsivas sencillas (cards, galerías).

Box: contenedor genérico (div con props de estilo).

Image: imágenes con estilos de Chakra.

Stack: stack genérico (vertical por defecto).
*/
import {
Button, VStack, Text, Heading, Input, Textarea, HStack,
SimpleGrid, Box, Image, Stack
} from "@chakra-ui/react";

import { Skeleton, SkeletonText, Spinner } from "@chakra-ui/react"; //Placeholders de carga

import { useAppKitProvider, useAppKitAccount, useAppKit } from "@reown/appkit/react";
/* 
useAppKitProvider: te da el provider conectado (RPC + firmante según contexto).

useAppKitAccount: info de la cuenta (address conectada, chainId, estado conectado/desconectado).

useAppKit: control del modal (abrir/cerrar, etc.).
*/
import { BrowserProvider, JsonRpcProvider, Contract, parseEther, formatEther, ethers } from "ethers";
/*
BrowserProvider: crea provider desde una wallet del navegador (injected / WalletConnect).

JsonRpcProvider: provider directo a una URL RPC (lecturas sin wallet; útil para modo “solo lectura”).

Contract: instanciar contratos (address + ABI + signer/provider).

parseEther, formatEther: conversión ETH ↔ wei.
*/
import NFT_ABI from "./abis/NFT.json";
import MARKET_ABI from "./abis/Marketplace.json";


// Sustituto del Divider ya que tenemos problemas para importarlo. El divider renderiza una linea <hr> de HTML

const DividerLine = (props) => (
  <Box as="hr" borderTopWidth="1px" borderColor="whiteAlpha.300" my="4" {...props} />
);

                                /* ================= Direcciones desplegadas y ABIs ================= */

const NFT_ADDRESS    = import.meta.env.VITE_NFT_ADDRESS;
const MARKET_ADDRESS = import.meta.env.VITE_MARKET_ADDRESS;

// Para instanciar contratos en el desarrollo de la dApp. 
// Si en el JSON hay solo el array => úsalo directo; si es artifact completo => usa .abi
const NFT_IFACE = Array.isArray(NFT_ABI) ? NFT_ABI : NFT_ABI.abi;
const MARKET_IFACE = Array.isArray(MARKET_ABI) ? MARKET_ABI : MARKET_ABI.abi;


                                     /* ================= Helpers RPC + reintentos ================= */

const READ_RPC = import.meta.env.VITE_RPC_SEPOLIA || "";

// Paginación para RPC
const MARKET_DEPLOY_BLOCK = Number(import.meta.env.VITE_MARKET_DEPLOY_BLOCK || 0); // Bloque donde se desplego el marketplace, para escanear empezando por este bloque, asi evitamos escanear antes de...
const BLOCK_PAGE   = 80;      // bajar si hay error 429
const PAGE_DELAY_MS = 1200;  // pausa entre páginas
const MIN_WINDOW   = 80;    // ventana mínima al reducir
const MAX_RETRIES  = 3;    // reintentos lecturas puntuales

// Cuántos NFTs traer por llamada y tope de páginas internas
const GLOBAL_BATCH_TARGET = 10;  // Nfts que se cargan por pagina
const GLOBAL_MAX_PAGES    = 6;   // seguridad para no abusar del RPC

// Helper para pausar entre reintentos
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Intenta ejecutar una funcion(fn), por ejemplo leer los listados del marketplace, si falla espera y vuelve a intentar, el delay crece linealmente, tras agotar intentos lanza error. Manejamos posibles errores intermitentes.
async function withRetry(fn, { attempts = MAX_RETRIES, delayMs = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await sleep(delayMs * (i + 1)); }
  }
  throw lastErr; // Si despues de todos los intentos sigue fallando, lanza el ultimo error
}

// Guarda instancia del provider. Funcion: memorizar el provider para no recrearlo cada vez que alguien llame a getReadProvider
let _cachedReader = null;

// Funcion que devuelve un provider de lectura, si existe un RPC en .env crea un JsonRpcProvider apuntando a ese RPC, valida que el RPC responde con getNetwork y sino controla el error. Si falla, utilizamos el provider de la wallet del usuario como fuente de lectura
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

  // Fallback: usa el provider de la wallet para lectura
  const browser = new BrowserProvider(walletProvider);
  _cachedReader = browser;
  return browser;
}

// Funcion que detecta si un error proviene de haber alcanzado el limite de peticiones en el RPC
function isRateLimit(e) {
  const code = e?.code ?? e?.error?.code ?? e?.status;
  const msg  = (e?.message || e?.error?.message || "").toLowerCase();
  return code === 429 || code === -32005 || msg.includes("rate limit") || msg.includes("too many") || msg.includes("quota") || msg.includes("exceed");
}

// Pide solo ItemListed en [from,to]; si -32005/429, reduce la ventana de bloques y reintenta
/* 
market: instancia de contrato Marketplace (new Contract(MARKET_ADDRESS, ABI, provider)).

from, to: bloques de inicio y fin para buscar eventos.

minWindow: tamaño mínimo de ventana de bloques para no dividir infinitamente.
*/
async function fetchListedRange(market, from, to, minWindow = 40) {
  let left = from, right = to;

  // El bucle continua hasta que sale con el return o lanza error definitivo en el throw
  while (true) {
    try {
      const logs = await market.queryFilter(market.filters.ItemListed(), left, right);
      return { logs, usedFrom: left, usedTo: right };
    } catch (e) {
      const msg  = (e?.message || e?.error?.message || "").toLowerCase();
      const code = e?.code ?? e?.error?.code ?? e?.status;
      const isRate = code === 429 || code === -32005 || msg.includes("rate limit") || msg.includes("too many");

      const win = right - left; // Calculamos el tamaño de la ventana
      if (!isRate || win <= minWindow) throw e; // Si no es un rate limit o la ventana es muy corta lanzamos error porque no se puede manejar

      // Si es un rate limit, recorta la ventana y vuelve a intentar
      const half = Math.max(minWindow, Math.floor(win / 2));
      right = left + half;
      await sleep(400);
    }
  }
}


                                                /* ================= Pinata helpers ================= */


const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

/** Sube un archivo al backend -> backend lo sube a Pinata. Devuelve ipfs://<hash> */
export async function uploadFileToPinata(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/pin/file`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Error subiendo archivo a Pinata");
  }

  const data = await res.json(); // { IpfsHash, ... }
  return `ipfs://${data.IpfsHash}`;
}

/** Sube un JSON al backend -> backend lo sube a Pinata. Devuelve ipfs://<hash> */
export async function uploadJSONToPinata(json) {
  const res = await fetch(`${API_BASE}/api/pin/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Error subiendo JSON a Pinata");
  }

  const data = await res.json(); // { IpfsHash, ... }
  return `ipfs://${data.IpfsHash}`;
}


/* === Funcion para que aparezcan todos los NFTs listados en el MarketPlace Global sin importar el tiempo que haya pasado, al ir por bloques tendremos que ir cargando mas paginas de NFts hasta llegar a los bloques donde se mintearon estos === */

// Escaneo on-chain: recorre hasta `maxScan` tokens y añade los que estén listados hoy
/*
nft: contrato ERC-721
market: contrato marketplace
maxScan: numero maximo de tokens a recorrer (200 para no saturar)
*/ 
async function scanCollectionListings(nft, market, maxScan = 200) {
  // Iremos guardfando los objetos con info de cada NFT listado
  const items = [];

  try {
    // Llamamos a totalSupply para saber los tokens que existen y utilizamos withRetry por si falla el RPC
    const total = Number(await withRetry(() => nft.totalSupply())); 
    // numerop de tokens a escanear, el menor entre totalSupply y maxScan
    const count = Math.min(total, maxScan);

    /* 
    - Recorremos los indices, tokenByIndex devuelve el tokenId real asociado al indice "i"
    - Consulta el marketplace para ver si el token esta listado
    - Si el NFT esta listado recupera el URI, si apunta a IPFS lo convierte a una URL HTTP usando gateway de Pinata
    - Descarga los metadatos desde el URI
    - Obtiene la imagen de la metadata, si tambien esta en IPFS la convierte a URL HTTP con gatewat Pinata
    - Contruimos en objeto con toda la info para la UI y lo pusheamos al array
    - Manejo de errores dentro del bucle, si falla un token no rompe todo el escaneo, solo avisa por consola
    - Manejo de errores externos, si el contrato no soporta totalSupply/tokenByIndex(no implementa ERC-721Enumerable) lo capturamos
    - Devolvemos el array con todos los NFTs listados
    */
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await withRetry(() => nft.tokenByIndex(i));
        const listing = await withRetry(() => market.getListing(NFT_ADDRESS, tokenId));

        if (listing.price > 0n) { // La n indica que el 0 es un BigInt, ethers v6 devuelve todos los uint256 como BigInt, listing devuelve un objeto con el seller y el price(BigInt).  Evitamos errores de tipo

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

// Arrow function que recibe un objeto it() y devuelve clave unica en formato String. tokenId-seller. Sirve para deduplicar en un Map (si llega el mismo NFT listado por el mismo seller, machaca la entrada anterior). Si el mismo token se vuelve a listar pero con otro seller(que previamente lo ha comprado) esta clave cambia
const makeKey = (it) => `${it.tokenId}-${(it.seller || "").toLowerCase()}`;

/*
Funcion que ordena los NFTs por blockNumber descendente
Si empatan (si los dos nfts se mintearon en el mismo bloque) los ordena por tokenId descendente
a y b son dos objetos de listings, dos NFTs con sus metadatos
*/ 

function sortListings(a, b) {
  const ba = a.blockNumber ?? 0 // si a.blocknumber es undefined o null devuelve 0, sino devuelve a.blocknumber
  const bb = b.blockNumber ?? 0;

  if (bb !== ba) return bb - ba;
  return Number(b.tokenId || 0) - Number(a.tokenId || 0);
}

/*
Funcion que fusiona un batch con el estado previo sin duplicarlo. Evita duplicados cuando cargas mas listings
*/
function mergeBatchIntoState(batch) {
  if (!batch?.length) return;
  setAllListings(prev => {
    const map = new Map(prev.map(x => [makeKey(x), x]));
    for (const it of batch) map.set(makeKey(it), it);
    return Array.from(map.values()).sort(sortListings);
  });
}

                                              // ========= Helper indicadores de carga, mientras se cargan los nfts =========

const GLOBAL_SKELETON_COUNT = 6; // nº de tarjetas skeleton en la primera carga

// Card “placeholder” para una NFT. Componente de React
function NFTCardSkeleton() {
  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
      <Skeleton height="220px" /> {/* Tamaño del skeleton */}
      <Box mt="3">
        <Skeleton height="20px" width="70%" /> {/* Simula el nombre del NFT */}
        <SkeletonText mt="2" noOfLines={2} spacing="2" /> {/* Simula la descripcion */}
        <Skeleton mt="2" height="14px" width="40%" /> {/* Simula direccion del seller */}
        <Skeleton mt="3" height="32px" width="90px" /> {/* Simula el boton de accion (comprar) */}
      </Box>
    </Box>
  );
}

// Grid de skeletons para mantener el layout
function SkeletonGrid({ count = 6 }) {
  return (
    <SimpleGrid columns={[1, 2, 3]} spacing={5}> {/* Los NFTs se muestran de 3 en 3 (columnas) con una separacion (spacing) entre tarjetas. Grid responsive, con esto las tarjetas skeleton se adaptan al tamaño de la pantalla */}

    {/* Crea array vacio e itera sobre el, en cada iteracion renderiza un NFTCardSkeleton, hay que darle una key unica a cada elemento(requerido por React en listas) */}
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
  const [busy, setBusy] = useState(false); // Lo utiliamos para deshabilitar botones y mostrar spinners

  // gallery
  const [myNFTs, setMyNFTs] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  // proceeds (saldo a retirar)
  const [proceedsEth, setProceedsEth] = useState("0");

  // Handler de <input type="file">, toma el primer archivo seleccionado, si no hay archivo, guarda null. Queda en estado para usarlo luego(subir a IPFS, Pinata)
  const onPickFile = (e) => setFile(e.target.files?.[0] || null);

  // Marketplace Global
  const [allListings, setAllListings] = useState([]);

  /*Cursor para paginacion por bloques.
  nextTo: siguiente bloque final al que llegar en la proxima pagina/consulta
  done: si ya terminamos de recorres el rango(no quedan mas paginas de bloques)
  Esrte estado permite cargar mas incrementalmente sin volver a empezar desde el bloque deploy
  */
  const [globalCursor, setGlobalCursor] = useState({ nextTo: 0, done: false });

  // Flag de carga para el grid global, muestra SkeletonGrid mientras pides otra pagina de datos/eventos 
  const [loadingGlobal, setLoadingGlobal] = useState(false);


  // Modal de precio
  const [priceModal, setPriceModal] = useState({
    isOpen: false, // Visible o oculto
    mode: "list",// "list" | "update"
    tokenId: null,
    defaultPrice: "",
    name: "",
  });

  //================== Desactivar boton cuando esta en uso ==================

  // loading por NFT (mapa por tokenId). Permite saber si un boton en concreto esta ocupado
  const [txLoading, setTxLoading] = useState({}); // { [key: string]: boolean }

  // Helpers de clave. Generar identificadores unicos para cada accion de un NFT.
  // Guardan estados separados en txLoading, asi puedes marcar solo el boton de comprar en loading sin afectar al de cancelar
  // Consultar rapido si una accion esta ocupada
  const kBuy    = (id) => `buy:${String(id)}`;
  const kCancel = (id) => `cancel:${id}`;
  const kList   = (id) => `list:${id}`;
  const kUpdate = (id) => `update:${id}`;

  // Setter genérico. Para marcar/desmarcar una accion en curso. Ej: setLoading(kBuy(12), true) activa el spinner del botón “comprar” del token 12.
  function setLoading(key, value) {
    setTxLoading(prev => ({ ...prev, [key]: !!value }));
  }

  // ¿Algún botón de este token está ocupado?
  /*
  Mira en busyRef.current[kBuy(id)] (candado booleano inmediato) por si hay un candado inmediato, si esta, devuelve true
  Recorre txLoading, si encuentra una clave que termina en :<id> y su valor es true, devuelve true, si no encuentra nada devuelve false
  Resultado: se puede deshanilitar todos los botones de ese NFT si alguna accion suya esta ejecutandose
  */
  function isTokenBusy(id) {
    const suffix = `:${String(id)}`; // Permite detectar cualquier clave que termine en ese token
    if (busyRef.current[kBuy(String(id))]) return true; // refleja el lock inmediato
    
    for (const k in txLoading) {
      if (k.endsWith(suffix) && txLoading[k]) return true;
    }
    return false;
  }

  // Normalizar la clave, por si el tokenId viene como BigInt/number/string
  const keyFor = (id) => `buy:${String(id)}`;

  // Candado inmediato
  const busyRef = useRef({});

  // Util para deduplicar clicks dobles o evitar lanzar la misma tx dos veces
  const inFlight = React.useRef(new Set()); // Set<string>
  
  // Wrapper genérico para clicks con lock + loading por clave. Sirve para evitar clicks duplicados (doble transaccion en Metamask)
  // Recibe keyIn(clave unica para identificar operacion mint, buy, approve...)
  // event (evente click del boton, para poder hacer preventDefault)
  // fn (funcion que se quiere ejecutar, transaccion, llamana on chain)

const runWithLock = async (keyIn, event, fn) => {
  const key = String(keyIn ?? "");
  const btn = event?.currentTarget;

  try {
    // Evitamos el comportamiento por defecto del boton, evita que el formulario se recargue o que el evento dispare multiples listeners
    event?.preventDefault?.();
    event?.stopPropagation?.();

    // si ya hay operación en curso para este key, ignorar el nuevo click
    if (busyRef.current[key]) {
      btn?.blur?.();
      console.info("[lock] ignored (already busy):", key);
      return false;
    }

    // bloqueo instantáneo (DOM) + estado de loading
    busyRef.current[key] = true;
    if (btn) btn.disabled = true; // bloqueo inmediato del botón
    setLoading(key, true);

    console.info("[lock] start:", key);
    await fn(); // aquí se abre MetaMask y esperamos
    console.info("[lock] done:", key);
    return true;

  } catch (e) { // Capturamos y manejamos el error en el caso de que exista
    const code = e?.code ?? e?.error?.code;
    const msg  = (e?.message || e?.error?.message || "").toLowerCase();
    console.warn("[lock] error:", key, code, msg);

    if (code === 4001 || msg.includes("user rejected")) { // 4001 codigo estandar de rechazo de transaccion de Metamask(si el usuario cancelo)
      showInfo("Operación cancelada por el usuario");
    } else {
      showError(e, "Ha fallado la operación");
    }
    return false;

  } finally {
    // liberar SIEMPRE, incluso si hay error
    setLoading(key, false);
    busyRef.current[key] = false;
    if (btn) btn.disabled = false; //re-habilitar boton al cancelar/fallar/terminar
    btn?.blur?.(); // .blur() medoto nativo del DOM que quita el foco del elemento activo
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


  // loading por tokenId (compra). Objeto de estados booleanos. Indica que NFTs estan en proceso de compra. Valor true => boton deshabilitado/spinner activo
  const [txLoadingBuy, setTxLoadingBuy] = useState({}); // { [tokenId: string]: boolean }

  /* setTokenLoadingBuy
  Funcion para actualizar solamente un estado de un token en especifico sin perder los demas

  Coge el estado actual txLoading(nft que esta en proceso de compra), utiliza prev para obtener el estado anterior del nft(evita problemas si hay actualizaciones simultaneas) y crea un nuevo objeto de estado, copiando el estado anterior y luego sobreescribiendo o añadiento una clave con el nuevo valor

  Con !!value forzamos que el valor sea booleano
  */
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

    // Helpers para mostrar mensajes de usuario

    /* 
    Centraliza como se muestran los errores al usuario.
    Si le llega un string, lo muestra directamente, si le llega un objeto error, lo formatea con la funcion anterior ErrMsg()
    */
    function showError(eOrMsg, fallback) {
      const msg = typeof eOrMsg === "string" ? eOrMsg : errMsg(eOrMsg, fallback);
      console.error("[UI Error]", msg, eOrMsg);
      setUiError(msg);
    }

    // Muestra mensaje informativo.
    // Si autoCloseMs tiene valor, por defecto 3500 ms, lo limpia automaticamente despues de ese tiempo => el mensaje desaparece
    function showInfo(message, autoCloseMs = 3500) {
      setUiInfo(message);
      if (autoCloseMs) setTimeout(() => setUiInfo(null), autoCloseMs);
    }


    // Activa/desactiva autoload desde .env si quieres (por defecto: ON)
    const AUTOLOAD_GLOBAL =
      (import.meta.env.VITE_AUTOLOAD_GLOBAL ?? "true").toLowerCase() !== "false";

    // Evita doble ejecución en StrictMode, no provoca re-renderizados, se usa para recordar si ya hicimos la carga inicial del marketplace
    const autoLoadRef = React.useRef(false);

  // useEffect que carga automáticamente los listados del marketplace(NFTs disponibles) cuando la app detexta que ya tiene disponible un provider(conexion a la blockchain o a Metamask) y lo hace solo una vez aunque React intente ejecutarlo mas veces(como ocurre en StrictMode en desarrollo) Este useEffect se ejecuta al montar el componente por primera vez y cada vez que cambie walletProvider (cuando el usuario se conecta o cambia de wallet) 

  React.useEffect(() => {
    if (!AUTOLOAD_GLOBAL) return;

    // Si ya hicimos el autoload, no repetir (StrictMode provoca doble render en dev)
    if (autoLoadRef.current) return;

    // Si no tienes READ_RPC y aún no hay walletProvider, espera a que exista
    // (con READ_RPC getReadProvider ya trabaja sin wallet conectada)
    if (!READ_RPC && !walletProvider) return;

    autoLoadRef.current = true;

    // Reset de filtros que hayan podido quedar en una sesion anterior
    setQ("");
    setMinP("");
    setMaxP("");
    setSort("recent");

    // Carga inicial del marketplace
    loadAllListings(true);
  }, [walletProvider]); // se disparará cuando haya provider disponible

    // -----------------------------------------------------------------------

    // =============== Funciones que controlan la paertura y cierre del modal de precio usado para listar o actualizar NFTs en el marketplace ================

  // Busca en la lista de mis nfts el nft con el token id que se le pasa por la funcion, si lo encuentra obtiene su name para mostrarlo en el modal, sino usa string vacio como fallback.
  // Llama a setPriceModal para abrir el modal y ponerlo en venta
  function openListModal(tokenId, name) {
  const fallbackName = myNFTs.find(n=>n.tokenId === String(tokenId))?.name || "";
  setPriceModal({ 
    isOpen: true, 
    mode: "list", 
    tokenId, 
    defaultPrice: "0.01", 
    name: name ?? fallbackName });
  }

  // Busca en nft con el tokenid, abre el modal en modo update para actualizar el precio de un NFT ya listado
  function openUpdateModal(tokenId, currentPrice, name) {
    const fallbackName = myNFTs.find(n=>n.tokenId === String(tokenId))?.name || ""; // “Busca en myNFTs el primer NFT cuyo tokenId sea igual al tokenId dado (convertido a string).Si lo encuentras, coge su name; si no lo encuentras (o el nombre es falsy), usa "".”
    setPriceModal({
      isOpen: true,
      mode: "update",
      tokenId,
      defaultPrice: String(currentPrice ?? "0.01"),
      name: name ?? fallbackName });
  }

  // Obtiene el estado previo p de setPriceModal, crea un nuevo objeto con todas las propiedades pero cambiando solo el isOpen:False para cerrar el modal sin borrar su contenido, esto permite al modal conservar los datos por si el usuario lo vuelve a abrir rapidamente.
  function closePriceModal() {
    setPriceModal(p => ({ ...p, isOpen: false }));
  }

  // ====================================================================

  // Confirmar el precio introducido por el usuario al listar o actualizar un NFT
  async function confirmPrice(priceStr) {
    try {
      if (!priceStr || Number(priceStr) <= 0) {
        alert("Introduce un precio > 0");
        return;
      }
      const { mode, tokenId } = priceModal;
      const key = mode === "list" ? kList(tokenId) : kUpdate(tokenId); // 

      setLoading(key, true);

      // Si mode del priceModal === "list", seleccionamos el token, comprobamos si está listado, si ya está listado paramos la ejecucion de la funcion. Si no esta listado esperamos a que se ejecute la funcion listToken(listItem del marketplace.sol) y lista el NFT, si no lo lista asumimos que lo actualiza asi que esperamos a que se ejecute upDateListing.
      // Luego cerramos el modal, si hubiera cualquier error lo controlamos con el catch y finalmente volvemos a calcular la misma key y marcamos el proceso como no cargado, asi el boton se reactivará
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
  // ==================================================================== 

  /* ========= Firmas / contratos + acciones Marketplace ========= Interaccion con ERC-721 */

  // Funcion helper para obtener el signer para poder enviar transacciones
  const getSigner = async () => (await new BrowserProvider(walletProvider)).getSigner();

  // 
  async function ensureApprovalAll(owner) {
    const signer = await getSigner();
    const nft = new Contract(NFT_ADDRESS, NFT_IFACE, signer);

    // Comprobacion que las funciones isApprovedForAll y setApprovedForAll existen en el NFT_IFACE(ABI)
    try {
      nft.interface.getFunction("isApprovedForAll");
      nft.interface.getFunction("setApprovalForAll");
    } catch {
      throw new Error("ABI NFT sin isApprovedForAll/setApprovalForAll");
    }

    // Comprobamos que el marketplace tiene permiso para mover los nfts del owner. withRetry reintenta por si hay problemas con el RPC
    const approved = await withRetry(() => nft.isApprovedForAll(owner, MARKET_ADDRESS));
    if (approved) return;

    // Si el marketplace no tiene permiso, los aprobamos. Con staticCall ejecutamos la funcion "en seco" sin gastar gas para verificar que no se revierte, si hubiera algun error se lanzaria antes de consumir GAS
    await nft.setApprovalForAll.staticCall(MARKET_ADDRESS, true);

    // Estimacion el GAS necesario para la transaccion real
    const gas = await nft.setApprovalForAll.estimateGas(MARKET_ADDRESS, true);

    // Llamanda a setApprovalForAll para aprobar el marketplace. Gas limit +20% por dar un poco de margen ya que el GAS a la hora de ejecutar puede variar respecto a la estimacion (error de subestimacion), con este margen evitamos out of gas que pueden costar ETH (Si la transaccion cuesta 100 gas y tienes 70 no se ejecutara la transaccion y perderas los 70 de gas)
    const tx  = await nft.setApprovalForAll(MARKET_ADDRESS, true, { gasLimit: (gas * 120n) / 100n });
    await tx.wait(); // Espera a que la transaccion se haya minado

  } // A partir de aqui el marketplace ya puede transferir NFTs del user.

  // Implementamos las funciones necesarias del Marketplace.sol que vamos a utilizar en el Marketplace.
  // Creamos en cada funcion const signer y una instancia del contrato del marketplace porque:
  // 1- El signer puede cambiar de wallet, de red, desconectarse, esto crear re-renders, queremos una actualizacion del signer inmediata antes de ejecutar una funcion.
  // 2 - A la instancia del market se le pasa el signer asi que si hay algun cambio necesitamos tambien lo mas reciente

  async function listToken(tokenId, priceEth) {
    if (!priceEth) return;
    const signer = await getSigner();
    const me = (await signer.getAddress()).toLowerCase();

    await ensureApprovalAll(me);

    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);
    try { 
      market.interface.getFunction("listItem"); 
    } catch {
       alert("ABI Marketplace incorrecto"); return; }

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

// Esta bien checkear primero si el owner es el mismo que el seller para no seguir con la funcion. Tambien el crear dos instancias del contrato, la primera para leer el getListing sin pedir firma, la segunda solo si pasa la validacion entonces si que obtiene el signer y con esa simulamos gas y enviamos la transaccion real
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

    const value = listing.price;
    const signer = await getSigner();
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
  // Consulta en la blockchain cuanto ETH tiene acumulado el usuario por ventas en el marketplace(ganancias no retiradas)
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

  // Funcion para retirar als ganancias de las ventas del marketplace
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

  const handleMint = async () => {
    // Si no esta la wallet conectada abre el modal de conexion (EIP155 indica conexion Ethereum)
  if (!isConnected) return open({ view: "Connect", namespace: "eip155" });
  if (!walletProvider) return showError("No hay wallet provider");
  // Si no hay imagen o nombre en el NFT a mintear muestra error
  if (!file || !name)   return showError("Falta imagen y/o nombre");

  try {
    setBusy(true);
    showInfo("Subiendo a IPFS...");
    const imageURI = await uploadFileToPinata(file);

    showInfo("Creando metadata...");
    const tokenURI = await uploadJSONToPinata({
      name, 
      description: desc || "",
      image: imageURI,
    });

    showInfo("Firmando transacción de mint...");
    const provider = new BrowserProvider(walletProvider);
    const signer   = await provider.getSigner();
    const contract = new Contract(NFT_ADDRESS, NFT_IFACE, signer);

    const tx = await contract.mint(tokenURI);
    await tx.wait();

    showInfo("✅ NFT minteado con éxito");
    setName(""); setDesc(""); setFile(null); // Limpiamos los campos para dejar la UI lista para el siguiente mint
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

      // Devuelve info de la red actual, comprobamos si los contratos NFT y Marketplace tienen address(estan deployados en la blockchain)
      // Con Promise.all hacemos las tres llamadas en paralelo y ganamos tiempo haciendo las tres promesas, el orden de las variables debe coincidir con el orden de las promesas
      const [net, codeNFT, codeMKT] = await Promise.all([
        provider.getNetwork(),
        provider.getCode(NFT_ADDRESS),
        provider.getCode(MARKET_ADDRESS),
      ]);

      console.log("ChainId:", Number(net.chainId));
      console.log("NFT has code?:", codeNFT !== "0x");
      console.log("MKT has code?:", codeMKT !== "0x");

      if (codeNFT === "0x") {
        alert("NFT_ADDRESS no contiene contrato en esta red");
      }
      if (codeMKT === "0x") {
        alert("MARKET_ADDRESS no contiene contrato en esta red.");
        return;
      }

      // Verificacion del ABI marketplace
      try {
        market.interface.getFunction("getListing");
        market.interface.getFunction("getProceeds");
        console.log("ABI Marketplace OK");
      } catch (e) {
        console.error("ABI Marketplace desactualizado:", e);
        alert("ABI del Marketplace en src/abis/Marketplace.json no coincide con el deploy. Vuelve a copiar el array 'abi' del artifacts.");
        return;
      }

      // Leemos cuantos NFTs tiene la address, pasamos ese valor a number por si tenemos que tratarlo en algun bucle
      const balanceBN = await withRetry(() => nft.balanceOf(address));
      const balance = Number(balanceBN);
      console.log("balanceOf(address):", balance);

      if (balance === 0) {
        setMyNFTs([]);
        // actualizamos proceeds aunque no haya NFTs, se pueden tener ganancias aunque en este momento esta address no tenga NFTs 
        try {
          const proceeds = await withRetry(() => market.getProceeds(address));
          setProceedsEth(formatEther(proceeds));
        } catch (e) {
          console.warn("getProceeds falló (sin bloquear la UI):", e);
        }
        return;
      }

      // Obtener tokenIds del usuario: secuencial + retry (para evitar rate limits)
      const tokenIds = [];
      for (let i = 0; i < balance; i++) {
        try {
          // Obtiene el tokenId en la posicion i, reintenta 4 veces con 250ms entre intentos
          const id = await withRetry(() => nft.tokenOfOwnerByIndex(address, i), { attempts: 4, delayMs: 250 }); 
          tokenIds.push(id);
        } catch (e) { // Si tras los intentos falla, lo logueamos y seguimos con el siguiente index
          console.warn("tokenOfOwnerByIndex failed at index", i, e);
          continue;
        }
        await sleep(120); // Pausa entre llamadas para no saturar al RPC
      }
      console.log("tokenIds resolved:", tokenIds.map(x => x.toString())); // Mostramos los tokenIds como strings
      // transforma cada elemento x a string, se pasan porque los BigInt y BigNumber no se imprimien directamente bien en consola

      // construimos items (con retries)
      const items = [];
      // Recorremos tokenIds y los pasamos a string
      for (const tokenIdBN of tokenIds) {
        const tokenId = tokenIdBN.toString();

        const [rawURI, owner, listing] = await Promise.all([
          withRetry(() => nft.tokenURI(tokenId)), // URL metadatos (ipfs://...)
          withRetry(() => nft.ownerOf(tokenId)), // direccion actual del owner
          withRetry(() => market.getListing(NFT_ADDRESS, tokenId)), // estado del token en el marketplace
        ]);

        // Si el uri comienza por ipfs:// lo cambia a un gateway HTTP(Pinata) para que el neavegador pueda hacer fetch.
        // Descarga en JSON de metadatos
        let uri = rawURI;
        if (uri.startsWith("ipfs://")) uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        const meta = await withRetry(() => fetch(uri).then(r => r.json()));

        // Lo mismo con la imagen
        let img = meta.image;
        if (img?.startsWith("ipfs://")) img = img.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");

        const listed   = listing.price > 0n; // Considera que si el nft esta listado debe tener un precio mayor a 0n(BigInt)
        const priceEth = listed ? formatEther(listing.price) : null; // Convierte el precio (wei) a ETH legible para la UI con formatEther, si no está listado, null.

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
      showError(err, "Error cargando tus NFTs");
    } finally {
      setLoadingNFTs(false);
    }
  };


                              /*=================== Marketplace global =================== */


// Cargar Marketplace Global con paginación por bloques
// Reset = true => limpia/repuebla desde cero ; False = añade/actualiza sobre lo ya cargado
const loadAllListings = async (reset = true, target = GLOBAL_BATCH_TARGET) => {
  if (loadingGlobal) return; // Si hay una carga global en curso return para evitar ejecuciones simultaneas

  try {
    setMyNFTs([]);// ocultar “Mis NFTs” cuando abrimos el global
    setLoadingGlobal(true); // Cargando global (spinners/deshabilitar UI)

    const provider = await getReadProvider(walletProvider);
    const market   = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);
    const nft      = new Contract(NFT_ADDRESS, NFT_IFACE, provider);

    // Semilla del map con el estado actual (no perder lo que ya hay renderizado)
    const map = new Map((reset ? [] : allListings).map(it => [makeKey(it), it]));

    // WARM START: si reset, poblar con estado on-chain actual y pintar ya
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

    // Contadores listing validos y numero de paginas
    let collected = 0;
    let pages     = 0;

    const latest = await provider.getBlockNumber();
    // Si reset o no hay cursor, empieza desde el ultimo bloque. Si hay cursor renanuda desde el nextTo del cursor
    let to   = (reset || !globalCursor.nextTo) ? latest : globalCursor.nextTo;
    let done = false; // Indicador para cortar el bucle cuando no haya mas que buscar

    while (pages < GLOBAL_MAX_PAGES && collected < target && !done) {
      // Calcula el bloque inferior de la ventana actual
      const fromDesired = Math.max(MARKET_DEPLOY_BLOCK, to - (BLOCK_PAGE - 1));

      // SOLO ItemListed (helper con backoff)
      const { logs: listedLogs, usedFrom } =
        await fetchListedRange(market, fromDesired, to);

      const pageBatch = []; // items válidos de esta página
      for (const log of listedLogs) {
        const { nft: nftAddr, tokenId, seller } = log.args;
        const blockNumber = log.blockNumber;

        if (nftAddr.toLowerCase() !== NFT_ADDRESS.toLowerCase()) continue;

        // clave estable por token + seller (puede relistarse a otro seller en el futuro)
        const keyPreview = makeKey({ tokenId: tokenId.toString(), seller });
        if (map.has(keyPreview)) continue;
        
        // Estas validaciones se repiten en el script, intentar hacer un componente con estas validaciones
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

      // Si en la pagina actual se han reunido items (pageBartch), se fusionan con el estado de la UI. 
      // Pinta incrementalmente lo reunido en esta página (evita parpadeos/desapariciones)
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
    const digitsOnly   = /^\d+$/.test(raw);          // "6" Comprueba si el input son solo digitos
    const digitsFromRaw = raw.replace(/\D/g, "");    // "#6" -> "6" Extrae solo los digitos de raw quitando letras o simbolos
    const needle = raw.toLowerCase();               

    if (digitsOnly) {
      // Si es solo números, busca por tokenId exacto. Si no existe se reemplaza por cadena vacia para evitar errores
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
  const isNum = (x) => Number.isFinite(x); // Funcion que devuelve true solo si x es un numero finito

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
    // "recent": por blockNumber (mayor primero). Si no hay, ordenalo de id mas alto a mas bajo
    arr.sort((a,b) => {
      const ba = a.blockNumber ?? 0;
      const bb = b.blockNumber ?? 0;

      if (bb !== ba) return bb - ba;
      return Number(b.tokenId||0) - Number(a.tokenId||0);
    });
  }

  return arr;
}, [allListings, q, minP, maxP, sort]);

// Este useEffect controla la conexion la wallet, cambiamos de cuenta o de red. A parte de actualizar los datos de la wallet(direccion publica y balance), nos cargara de nuevo el marketplace, "Mis NFTs" o lo que proceda segun lo que pase

  useEffect(() => {
    // Si existe wallletProvider(Appkit) úsalo, sino intenta usar el provider de la wallet, si no hay ninguno no se pueden escuchar eventos
    const eth = walletProvider || (typeof window !== "undefined" ? window.ethereum : null);

    if (!eth || !eth.on) return; // Si el provider no existe o no soporta suscripcion de eventos(.on) return

    const onAccountsChanged = async(accounts) => {
      if (!accounts || accounts.length === 0) {
        // El usuario desconecto su wallet
        address(null);
        isConnected(false);
        setMyNFTs([]);
        return;
      }

      // El usuario cambió de wallet
      const newAddress = accounts[0].toLowerCase();
      address(newAddress);
      await loadMyNFTs();
      await refreshProceeds();
    };

    const onChainChanged = async (chainId) => {
      console.log("Red cambiada a:", chainId);
      // Actualiza el provider o fuerza una resincronizacion sin recargar
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      walletProvider(newProvider);
      await loadAllListings(true); // recarga el marketplace global
      await loadMyNFTs();
      await refreshProceeds();
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [walletProvider] // Nos pide meter todas las dependencias, de momento lo dejamos asi a ver si funciona, sino una forma de solucionarlo es declarar las variables con un useRef para apuntar a la ultima version de las funciones y despues sincronizarlas cuando cambien.

  /* 
  // 1) Crear refs para apuntar siempre a la última versión de tus funciones
      const loadMyNFTsRef = React.useRef(loadMyNFTs);
      const loadAllListingsRef = React.useRef(loadAllListings);
      const refreshProceedsRef = React.useRef(refreshProceeds);

  // 2) Sincronizarlas cuando cambien
      React.useEffect(() => { loadMyNFTsRef.current = loadMyNFTs; }, [loadMyNFTs]);
      React.useEffect(() => { loadAllListingsRef.current = loadAllListings; }, [loadAllListings]);
      React.useEffect(() => { refreshProceedsRef.current = refreshProceeds; }, [refreshProceeds]);
  */
)


  /* ================= Render =================  */ 

return (
  <VStack spacing={6} p={10} align="stretch" maxW="1000px" mx="auto">
    <Heading textAlign="center">NFT Marketplace</Heading>

        {/* Mensaje de error, si uiError es truthy visible para el usuario*/}
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

      {/* Mensaje de informacion, si uiInfo es truthy visible para el usuario*/}
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

    {/* Si no hay wallet conectada mostramos boton de conexion, si hay wallet mostramos direcion publica y botones*/}
    {!isConnected ? (
      <Button onClick={() => open({ view: "Connect", namespace: "eip155" })} colorScheme="teal">
        Conectar Wallet
      </Button>
    ) : (
      <VStack>
        <Text>Conectado como: {address?.slice(0, 6)}...{address?.slice(-4)}</Text>
        <HStack>
          <Button onClick={loadMyNFTs} isLoading={loadingNFTs} colorScheme="purple">
            Mis NFTs
          </Button>
          <Button onClick={refreshProceeds} variant="outline"> {/* El variant="outline" hace que el color del boton sea dark*/}
            Actualizar saldo
            </Button>
          <Button onClick={withdrawProceeds} isDisabled={Number(proceedsEth) <= 0}>
            Retirar {proceedsEth} ETH
          </Button>
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
          <Button onClick={() => loadAllListings(false)} isLoading={loadingGlobal} isDisabled={loadingGlobal} variant="outline">
            Cargar más
          </Button>
          )}
        </HStack>
      </VStack>
    )}


    {/* Formulario de minteo*/}
    <Input placeholder="Nombre del NFT" value={name} onChange={(e) => setName(e.target.value.slice(0,20))} />
    <Textarea placeholder="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
    <HStack><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></HStack>
    <Button onClick={handleMint} colorScheme="blue" isDisabled={!isConnected || !file || !name || busy}>
      {busy ? "Procesando..." : "Mint NFT"}
    </Button>

    {/*========= Galería (Mis NFTs)=========*/}

{/* Mis NFTs – loading → skeletons , entra si loadingNFts es true y si aun no hay NFts cargados*/}
{loadingNFTs && myNFTs.length === 0 && (
  <>
    <DividerLine />
    <Heading size="lg">Mis NFTs</Heading>
    <SimpleGrid columns={[1, 2, 3]} spacing={5}>
      {/* Crea un array temporal de 6 elementos vacios (_) y hace un .map sobre el. Asi generamos 6 skeletons placeholders de mientras que se cargan los NFts */}
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
          <Skeleton height="220px" />
          <Box mt="3">
            <Skeleton height="20px" width="70%" /> {/*Simula el nombre del NFT*/}
            <SkeletonText mt="2" noOfLines={2} spacing="2" /> {/*Simula la desripcion*/}
            <Skeleton mt="2" height="14px" width="40%" /> {/*Simula el precio */}
            <Skeleton mt="3" height="32px" width="90px" /> {/*Simula el boton*/}
          </Box>
        </Box>
      ))}
    </SimpleGrid>
  </>
)}

{/* Mis NFTs – carga los NFTs */}
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
                // Si solamente eres el dueño del nft, pero no esta listado mostramos el boton de listar
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

{/* Mis NFTs – vacío, no tienes ni NFTs listados ni sin listar o no estas en la red correcta*/}
{!loadingNFTs && myNFTs.length === 0 && isConnected && (
  <>
    <DividerLine />
    <Heading size="lg">Mis NFTs</Heading>
    <Box p="6" borderWidth="1px" borderRadius="md" bg="blackAlpha.200">
      <Text>No tienes NFTs (o no en esta red).</Text>
    </Box>
  </>
)}

{/* Paginación , Si hay listados cargados y aun quedan mas por traer, mostramos el boton cargar mas*/}
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

{/* Si no hay mas listados por cargar, mostramos mensaje informativo */}
{allListings.length > 0 && globalCursor.done && (
  <Text mt="4" textAlign="center" color="gray.400">
    Has llegado al inicio del deploy. No hay más listados antiguos.
  </Text>
)}

                                        {/* =====================Marketplace Global===================== */}

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
      {/* Desplegable, al hacer as="select" el box se renderiza como un select de HTML */}
      <Box as="select" value={sort} onChange={(e) => setSort(e.target.value)} maxW="220px" px={3} py={2} borderWidth="1px" borderRadius="md" background={"black"}>
        <option value="recent">Más recientes</option>
        <option value="price-asc">Precio: menor a mayor</option>
        <option value="price-desc">Precio: mayor a menor</option>
      </Box>
      {/* Informativo de los resultados que ha obtenido con el filtro  */}
      <Text fontSize="sm" color="gray.400"> 
        {filteredGlobal.length} resultados
      </Text>
    </HStack>

{/* Lista o estado vacío (con skeletons), se ejecuta cuando se esta cargando el estado global y aun no hay resultados porque no termino la carga inicial
Se renderizan los Skeletons */}

{loadingGlobal && filteredGlobal.length === 0 ? (
  // Primera carga: solo skeletons
  <SimpleGrid columns={[1, 2, 3]} spacing={5}>
    {Array.from({ length: GLOBAL_SKELETON_COUNT }).map((_, i) => (
      <NFTCardSkeleton key={`global-skel-${i}`} />
    ))}
  </SimpleGrid>

  // Si ya esta cargado (loadingGlobal=false) y existen filtros(hay resultados)
) : filteredGlobal.length > 0 ? (
  <>
    <SimpleGrid columns={[1, 2, 3]} spacing={5}>
      {filteredGlobal.map((nft) => {
        const me = address?.toLowerCase?.() || "";
        const cantBuy = (nft.seller || "").toLowerCase() === me; // es mi propio nft listado

        return (
          <Box
            // Creamos la key con el token y el seller ya que el seller puede cambiar, si alguien lo lista y otro lo compra el seller es diferente, React lo detectara y lo podra mostrar de nuevo cuando este NFT se liste de nuevo con otro seller diferente. 
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
              // Aqui desactiva el boton al hacer click en comprar, mientras se carga, el !! fuerza booleano
              isLoading={!!txLoading[kBuy(nft.tokenId)]}
              isDisabled={cantBuy || isTokenBusy(nft.tokenId)}
              // Señal de accesibilidad, lectores de pantalla saben que el control esta ocupado
              aria-busy={!!txLoading[kBuy(nft.tokenId)]}
              // A nivel de CSS, ignora clics/hover si el token esta en busy
              style={isTokenBusy(nft.tokenId) ? { pointerEvents: "none" } : undefined}
              // Tooltip que se muestra al dejar el raton encima del boton en el caso de que seas el owner del NFT
              title={cantBuy ? "No puedes comprar tu propio NFT" : undefined} 

              // Al clicar, runWithLock bloquea el boton y se ejecuta la funcion buyToken
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

      {/* Mientras se cargan más páginas, añadimos 3 skeletons al final para evitar saltos, genera un array temporal con los 3 skeletons*/}
      {loadingGlobal &&
        Array.from({ length: 3 }).map((_, i) => (
          <NFTCardSkeleton key={`global-skel-inline-${i}`} />
        ))}
    </SimpleGrid>

    {/* Botón de carga adicional si hay NFts listados para cargar */}
    {!globalCursor.done && (
      <Button
        onClick={() => loadAllListings(false)} // False para que no resetee lo cargado, sino que añada mas resultados al final
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

{/* === Modal de precio inline para listar o actualizar precio NFT  === */}

{priceModal?.isOpen && (
  <Box
    position="fixed"
    inset="0"
    bg="blackAlpha.500"
    display="flex"
    alignItems="center"
    justifyContent="center"
    zIndex={1000} // Asegura que quede por encima de cualquier otro elemento (Que no quede taopado por nada)
  >
    <Box bg="black" p="6" borderRadius="md" minW={["90vw","420px"]} borderWidth={"1px"} borderColor={"gray.600"} boxShadow={"lg"}>
      
      {/* Título dinámico, priceModal puedes ser list o update */}
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
