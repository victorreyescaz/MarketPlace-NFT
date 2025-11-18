/**
Utilidades para trabajar con RPCs: reintentos, provider de lectura cacheado y consulta de eventos paginada con manejo de rate limits.
 */

import { BrowserProvider, JsonRpcProvider } from "ethers";

const READ_RPC = import.meta.env.VITE_RPC_SEPOLIA || "";

// Paginación para RPC
const MARKET_DEPLOY_BLOCK = Number(
  import.meta.env.VITE_MARKET_DEPLOY_BLOCK || 0
); // Bloque donde se desplego el marketplace, para escanear empezando por este bloque, asi evitamos escanear antes de...
const BLOCK_PAGE = 80; // bajar si hay error 429
const PAGE_DELAY_MS = 1200; // pausa entre páginas
const MIN_WINDOW = 80; // ventana mínima al reducir
const MAX_RETRIES = 3; // reintentos lecturas puntuales

// Cuántos NFTs traer por llamada y tope de páginas internas
const GLOBAL_BATCH_TARGET = 10; // Nfts que se cargan por pagina
const GLOBAL_MAX_PAGES = 6; // seguridad para no abusar del RPC

// Helper para pausar entre reintentos
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Intenta ejecutar una funcion(fn), por ejemplo leer los listados del marketplace, si falla espera y vuelve a intentar, el delay crece linealmente, tras agotar intentos lanza error. Manejamos posibles errores intermitentes.
export async function withRetry(
  fn,
  { attempts = MAX_RETRIES, delayMs = 250 } = {}
) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr; // Si despues de todos los intentos sigue fallando, lanza el ultimo error
}

// Guarda instancia del provider. Funcion: memorizar el provider para no recrearlo cada vez que alguien llame a getReadProvider
let _cachedReader = null;

// Funcion que devuelve un provider de lectura, si existe un RPC en .env crea un JsonRpcProvider apuntando a ese RPC, valida que el RPC responde con getNetwork y sino controla el error. Si falla, utilizamos el provider de la wallet del usuario como fuente de lectura
export async function getReadProvider(walletProvider) {
  if (_cachedReader) return _cachedReader;

  if (READ_RPC) {
    const p = new JsonRpcProvider(READ_RPC);
    try {
      await p.getNetwork(); // valida que el RPC responde
      _cachedReader = p;
      return p;
    } catch (e) {
      console.warn(
        "[getReadProvider] READ_RPC falló, usando BrowserProvider:",
        e?.code || e?.message || e
      );
    }
  }

  // Fallback: usa el provider de la wallet para lectura
  const browser = new BrowserProvider(walletProvider);
  _cachedReader = browser;
  return browser;
}

// Funcion que detecta si un error proviene de haber alcanzado el limite de peticiones en el RPC
export function isRateLimit(e) {
  const code = e?.code ?? e?.error?.code ?? e?.status;
  const msg = (e?.message || e?.error?.message || "").toLowerCase();
  return (
    code === 429 ||
    code === -32005 ||
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("quota") ||
    msg.includes("exceed")
  );
}

// Pide solo ItemListed en [from,to]; si -32005/429, reduce la ventana de bloques y reintenta
/* 
market: instancia de contrato Marketplace (new Contract(MARKET_ADDRESS, ABI, provider)).

from, to: bloques de inicio y fin para buscar eventos.

minWindow: tamaño mínimo de ventana de bloques para no dividir infinitamente.
*/
export async function fetchListedRange(market, from, to, minWindow = 40) {
  let left = from,
    right = to;

  // El bucle continua hasta que sale con el return o lanza error definitivo en el throw
  while (true) {
    try {
      const logs = await market.queryFilter(
        market.filters.ItemListed(),
        left,
        right
      );
      return { logs, usedFrom: left, usedTo: right };
    } catch (e) {
      const msg = (e?.message || e?.error?.message || "").toLowerCase();
      const code = e?.code ?? e?.error?.code ?? e?.status;
      const isRate =
        code === 429 ||
        code === -32005 ||
        msg.includes("rate limit") ||
        msg.includes("too many");

      const win = right - left; // Calculamos el tamaño de la ventana
      if (!isRate || win <= minWindow) throw e; // Si no es un rate limit o la ventana es muy corta lanzamos error porque no se puede manejar

      // Si es un rate limit, recorta la ventana y vuelve a intentar
      const half = Math.max(minWindow, Math.floor(win / 2));
      right = left + half;
      await sleep(400);
    }
  }
}
