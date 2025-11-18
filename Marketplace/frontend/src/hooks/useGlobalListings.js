/*
Hook que sincroniza el marketplace global: 
  -- Carga listados desde backend o blockchain
  -- Maneja filtro/orden y expone `filteredGlobal`, `loadAllListings`, `globalCursor` y setters de búsqueda.


-- Mantiene en estado todos los listados (allListings), el cursor de paginación (globalCursor), flags de carga y los filtros (q, minP, maxP, sort).

-- Ofrece loadAllListings que decide si consultar al backend (fetchGlobalListings) o leer directamente de contratos (getReadProvider, fetchListedRange, market.getListing, etc.), normaliza cada NFT y actualiza globalCursor.

-- Usa useMemo para derivar filteredGlobal aplicando búsqueda textual, rango de precios y orden (reciente o por precio).

-- Expone helpers (resetFilters, clearListings, setters individuales) para que la UI controle formularios y botones (MarketplaceControls, GlobalListings).
 */

import { useCallback, useMemo, useState } from "react";
import { Contract, formatEther } from "ethers";
import { getReadProvider, fetchListedRange, withRetry } from "../services/rpcs";
import { scanCollectionListings } from "../services/pinata";
import { fetchGlobalListings } from "../services/marketplaceApi";
import {
  NFT_ADDRESS,
  NFT_IFACE,
  MARKET_ADDRESS,
  MARKET_IFACE,
} from "../utils/contract";
import {
  makeKey,
  sortListings,
  mergeBatchIntoState as mergeListingsBatch,
} from "../utils/helpers_loadAllListings";

const MARKET_DEPLOY_BLOCK = Number(
  import.meta.env.VITE_MARKET_DEPLOY_BLOCK || 0
);
const GLOBAL_BATCH_TARGET = Number(
  import.meta.env.VITE_GLOBAL_BATCH_TARGET || 10
);
const GLOBAL_MAX_PAGES = Number(import.meta.env.VITE_GLOBAL_MAX_PAGES || 6);
const BLOCK_PAGE = Number(import.meta.env.VITE_BLOCK_PAGE || 80);
const PAGE_DELAY_MS = Number(import.meta.env.VITE_PAGE_DELAY_MS || 1200);
const READ_RPC = (import.meta.env.RPC_SEPOLIA ?? "").trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeListing = (raw = {}) => ({
  tokenId: String(raw.tokenId ?? ""),
  name: raw.name ?? "",
  description: raw.description ?? "",
  image: raw.image ?? "",
  seller: (raw.seller || "").toLowerCase(),
  priceEth: raw.priceEth ?? "0",
  blockNumber: Number(raw.blockNumber ?? 0),
});

export function useGlobalListings({
  walletProvider,
  preferBackend: preferBackendProp,
  showError,
  showInfo,
}) {
  const [allListings, setAllListings] = useState([]);
  const [globalCursor, setGlobalCursor] = useState({ nextTo: 0, done: false });
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const [q, setQ] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [sort, setSort] = useState("recent");

  /*
  Si el hook recibe preferBackend via props(preferedBackendProps) usa ese valor para sacar datos on-chain
  Si no lo recibe, evalua, si no hay wallet conectada ni rpc publico, preferira consultar al backend
  */
  const preferBackend = preferBackendProp ?? (!walletProvider && !READ_RPC);

  const resetFilters = useCallback(() => {
    setQ("");
    setMinP("");
    setMaxP("");
    setSort("recent");
  }, []);

  const clearListings = useCallback(() => setAllListings([]), []);

  const mergeBatchIntoState = useCallback(
    (batch, { reset = false } = {}) => {
      if (!batch?.length) return;
      const normalized = batch.map(normalizeListing);
      setAllListings((prev) => {
        const base = reset ? [] : prev;
        return mergeListingsBatch(base, normalized);
      });
    },
    [setAllListings]
  );

  const loadFromBackend = useCallback(
    async ({ reset, target }) => {
      try {
        const nextTo = reset ? undefined : globalCursor?.nextTo;
        const res = await fetchGlobalListings({
          target,
          cursor:
            typeof nextTo === "number" && Number.isFinite(nextTo)
              ? nextTo
              : undefined,
          scan: reset,
        });

        if (Array.isArray(res?.listings)) {
          mergeBatchIntoState(res.listings, { reset });
        }

        if (res?.cursor) {
          setGlobalCursor({
            nextTo: Number(res.cursor.nextTo ?? 0),
            done: Boolean(res.cursor.done),
          });
        }
      } catch (err) {
        showError?.(err, "No se pudo cargar el Marketplace Global");
        throw err;
      }
    },
    [globalCursor, mergeBatchIntoState, setGlobalCursor, showError]
  );

  const loadAllListings = useCallback(
    async (reset = true, target = GLOBAL_BATCH_TARGET) => {
      if (loadingGlobal) return;
      const useBackend = preferBackend || (!READ_RPC && !walletProvider);

      try {
        setLoadingGlobal(true);

        if (useBackend) {
          await loadFromBackend({ reset, target });
          return;
        }

        const provider = await getReadProvider(walletProvider);
        const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);
        const nft = new Contract(NFT_ADDRESS, NFT_IFACE, provider);

        const map = new Map(
          (reset ? [] : allListings).map((it) => [makeKey(it), it])
        );

        if (reset) {
          const scanned = await scanCollectionListings(nft, market, 200);
          if (scanned.length > 0) {
            for (const s of scanned) {
              map.set(makeKey(s), {
                ...s,
                blockNumber: s.blockNumber ?? 0,
              });
            }
            setAllListings(Array.from(map.values()).sort(sortListings));
          } else {
            showInfo?.("Escaneando listado actual…");
          }
        }

        let collected = 0;
        let pages = 0;

        const latest = await provider.getBlockNumber();
        let to = reset || !globalCursor.nextTo ? latest : globalCursor.nextTo;
        let done = false;

        while (pages < GLOBAL_MAX_PAGES && collected < target && !done) {
          const fromDesired = Math.max(
            MARKET_DEPLOY_BLOCK,
            to - (BLOCK_PAGE - 1)
          );

          const { logs: listedLogs, usedFrom } = await fetchListedRange(
            market,
            fromDesired,
            to
          );

          const pageBatch = [];
          for (const log of listedLogs) {
            const { nft: nftAddr, tokenId, seller } = log.args;
            const blockNumber = log.blockNumber;

            if (nftAddr.toLowerCase() !== NFT_ADDRESS.toLowerCase()) continue;

            const keyPreview = makeKey({
              tokenId: tokenId.toString(),
              seller,
            });
            if (map.has(keyPreview)) continue;

            try {
              const listing = await withRetry(() =>
                market.getListing(NFT_ADDRESS, tokenId)
              );
              if (listing.price > 0n) {
                let uri = await withRetry(() => nft.tokenURI(tokenId));
                if (uri.startsWith("ipfs://")) {
                  uri = uri.replace(
                    "ipfs://",
                    "https://gateway.pinata.cloud/ipfs/"
                  );
                }
                const meta = await withRetry(() =>
                  fetch(uri).then((r) => r.json())
                );
                let img = meta.image;
                if (img?.startsWith("ipfs://")) {
                  img = img.replace(
                    "ipfs://",
                    "https://gateway.pinata.cloud/ipfs/"
                  );
                }

                const sellerLower = (
                  listing.seller ||
                  seller ||
                  ""
                ).toLowerCase();
                const item = {
                  tokenId: tokenId.toString(),
                  name: meta.name,
                  description: meta.description,
                  image: img,
                  seller: sellerLower,
                  priceEth: formatEther(listing.price),
                  blockNumber,
                };

                map.set(makeKey(item), item);
                pageBatch.push(item);
              }
            } catch (e) {
              console.warn(
                "[Global] no resolví tokenId=",
                tokenId?.toString?.(),
                e?.message || e
              );
            }
          }

          if (pageBatch.length) mergeBatchIntoState(pageBatch);

          collected += pageBatch.length;
          done = usedFrom <= MARKET_DEPLOY_BLOCK;
          to = usedFrom - 1;
          pages++;

          if (!done && collected < target && pages < GLOBAL_MAX_PAGES) {
            await sleep(PAGE_DELAY_MS);
          }
        }

        setAllListings(Array.from(map.values()).sort(sortListings));
        setGlobalCursor({ nextTo: to, done });
      } catch (err) {
        showError?.(err, "Error cargando el Marketplace Global");
      } finally {
        setLoadingGlobal(false);
        if (!useBackend) {
          await sleep(PAGE_DELAY_MS);
        }
      }
    },
    [
      allListings,
      globalCursor,
      loadFromBackend,
      loadingGlobal,
      mergeBatchIntoState,
      preferBackend,
      showError,
      showInfo,
      walletProvider,
    ]
  );

  const filteredGlobal = useMemo(() => {
    let arr = Array.isArray(allListings) ? [...allListings] : [];
    const raw = q.trim();

    if (raw) {
      const digitsOnly = /^\d+$/.test(raw);
      const digitsFromRaw = raw.replace(/\D/g, "");
      const needle = raw.toLowerCase();

      if (digitsOnly) {
        arr = arr.filter((it) => String(it.tokenId ?? "") === raw);
      } else if (digitsFromRaw) {
        arr = arr.filter((it) => {
          const tokenStr = String(it.tokenId ?? "");
          const inId = tokenStr === digitsFromRaw;

          const inName = (it.name || "").toLowerCase().includes(needle);
          const inDesc = (it.description || "").toLowerCase().includes(needle);
          const inSeller = (it.seller || "").toLowerCase().includes(needle);

          return inId || inName || inDesc || inSeller;
        });
      } else {
        arr = arr.filter((it) => {
          const inName = (it.name || "").toLowerCase().includes(needle);
          const inDesc = (it.description || "").toLowerCase().includes(needle);
          const inSeller = (it.seller || "").toLowerCase().includes(needle);
          return inName || inDesc || inSeller;
        });
      }
    }

    const min = parseFloat(minP);
    const max = parseFloat(maxP);
    const isNum = (x) => Number.isFinite(x);

    if (isNum(min)) {
      arr = arr.filter((it) => Number.parseFloat(it.priceEth ?? "0") >= min);
    }
    if (isNum(max)) {
      arr = arr.filter((it) => Number.parseFloat(it.priceEth ?? "0") <= max);
    }

    if (sort === "price-asc") {
      arr.sort(
        (a, b) =>
          Number.parseFloat(a.priceEth || "0") -
          Number.parseFloat(b.priceEth || "0")
      );
    } else if (sort === "price-desc") {
      arr.sort(
        (a, b) =>
          Number.parseFloat(b.priceEth || "0") -
          Number.parseFloat(a.priceEth || "0")
      );
    } else {
      arr.sort((a, b) => {
        const ba = a.blockNumber ?? 0;
        const bb = b.blockNumber ?? 0;

        if (bb !== ba) return bb - ba;
        return Number(b.tokenId || 0) - Number(a.tokenId || 0);
      });
    }

    return arr;
  }, [allListings, q, minP, maxP, sort]);

  return {
    allListings,
    filteredGlobal,
    loadingGlobal,
    globalCursor,
    loadAllListings,
    clearListings,
    q,
    minP,
    maxP,
    sort,
    setQ,
    setMinP,
    setMaxP,
    setSort,
    resetFilters,
  };
}
