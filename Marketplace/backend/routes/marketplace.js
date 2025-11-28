/*
Endpoint para generar un feed paginado y limpio de todos los NFTs listados en el marketplace combinando datos on-chain y metadata IPFS, listo para que el frontend lo muestre
*/


import express from "express";
import fetch from "node-fetch";
import { JsonRpcProvider, Contract, formatEther } from "ethers";
import marketArtifact from "../artifacts/contracts/Marketplace.sol/Marketplace.json" with { type: "json" };
import nftArtifact from "../artifacts/contracts/NFT.sol/NFT.json" with { type: "json" };

const RPC_SEPOLIA = (
  process.env.RPC_SEPOLIA ||
  process.env.VITE_RPC_SEPOLIA ||
  ""
).trim();
const MARKET_ADDRESS = (
  process.env.MARKET_ADDRESS ||
  process.env.VITE_MARKET_ADDRESS ||
  ""
).trim();
const NFT_ADDRESS = (
  process.env.NFT_ADDRESS ||
  process.env.VITE_NFT_ADDRESS ||
  ""
).trim();

const MARKET_DEPLOY_BLOCK = Number(
  process.env.MARKET_DEPLOY_BLOCK || process.env.VITE_MARKET_DEPLOY_BLOCK || 0
);
const DEFAULT_BATCH_TARGET = Number(
  process.env.GLOBAL_BATCH_TARGET || process.env.VITE_GLOBAL_BATCH_TARGET || 10
);
const DEFAULT_MAX_PAGES = Number(
  process.env.GLOBAL_MAX_PAGES || process.env.VITE_GLOBAL_MAX_PAGES || 6
);
const BLOCK_PAGE = Number(
  process.env.BLOCK_PAGE || process.env.VITE_BLOCK_PAGE || 80
);
const PAGE_DELAY_MS = Number(
  process.env.PAGE_DELAY_MS || process.env.VITE_PAGE_DELAY_MS || 1200
);
const MAX_SCAN_TOKENS = Number(process.env.MARKETPLACE_SCAN_MAX || 200);
const MAX_LIMIT = Number(process.env.MARKETPLACE_MAX_LIMIT || 50);
const MAX_PAGE_CAP = Number(process.env.MARKETPLACE_MAX_PAGES || 12);
const IPFS_GATEWAY =
  (process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/").replace(
    /\/$/,
    ""
  ) + "/";

const router = express.Router();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const makeKey = (it) =>
  `${it.tokenId}-${(it.seller || "").toLowerCase() || ""}`;
const sortListings = (a, b) => {
  const ba = a.blockNumber ?? 0;
  const bb = b.blockNumber ?? 0;
  if (bb !== ba) return bb - ba;
  return Number(b.tokenId || 0) - Number(a.tokenId || 0);
};
const clampNumber = (value, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

let contractsPromise = null;

async function getContracts() {
  if (!RPC_SEPOLIA || !MARKET_ADDRESS || !NFT_ADDRESS) {
    throw new Error(
      "Faltan RPC_SEPOLIA, MARKET_ADDRESS o NFT_ADDRESS en las variables de entorno"
    );
  }

  if (!contractsPromise) {
    contractsPromise = (async () => {
      const provider = new JsonRpcProvider(RPC_SEPOLIA);
      await provider.getNetwork(); // valida RPC
      const market = new Contract(MARKET_ADDRESS, marketArtifact.abi, provider);
      const nft = new Contract(NFT_ADDRESS, nftArtifact.abi, provider);
      return { provider, market, nft };
    })();
  }
  return contractsPromise;
}

async function withRetry(task, { attempts = 3, delayMs = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (err) {
      lastErr = err;
      await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr;
}

function isRateLimit(err) {
  const code = err?.code ?? err?.error?.code ?? err?.status;
  const msg = (err?.message || err?.error?.message || "").toLowerCase();
  return (
    code === 429 ||
    code === -32005 ||
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("quota") ||
    msg.includes("exceed")
  );
}

async function fetchListedRange(
  market,
  from,
  to,
  minWindow = Math.max(20, Math.floor(BLOCK_PAGE / 2))
) {
  let left = from;
  let right = to;

  while (true) {
    try {
      const logs = await market.queryFilter(
        market.filters.ItemListed(),
        left,
        right
      );
      return { logs, usedFrom: left, usedTo: right };
    } catch (err) {
      const windowSize = right - left;
      if (!isRateLimit(err) || windowSize <= minWindow) throw err;

      const halfWindow = Math.max(minWindow, Math.floor(windowSize / 2));
      right = left + halfWindow;
      await sleep(400);
    }
  }
}

const normalizeIpfsUri = (uri) => {
  if (!uri?.startsWith("ipfs://")) return uri;
  return uri.replace("ipfs://", IPFS_GATEWAY);
};

async function resolveMetadata(nft, tokenId) {
  let uri = await withRetry(() => nft.tokenURI(tokenId));
  uri = normalizeIpfsUri(uri);
  const meta = await withRetry(() => fetch(uri).then((r) => r.json()));
  const image = normalizeIpfsUri(meta?.image);
  return { ...meta, image };
}

async function scanCollectionListings(nft, market, maxScan = MAX_SCAN_TOKENS) {
  const items = [];
  if (!maxScan) return items;

  try {
    const total = Number(await withRetry(() => nft.totalSupply()));
    const count = Math.min(total, maxScan);

    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await withRetry(() => nft.tokenByIndex(i));
        const listing = await withRetry(() =>
          market.getListing(NFT_ADDRESS, tokenId)
        );
        if (listing.price <= 0n) continue;

        const { name, description, image } = await resolveMetadata(
          nft,
          tokenId
        );
        items.push({
          tokenId: tokenId.toString(),
          name,
          description,
          image,
          seller: (listing.seller || "").toLowerCase(),
          priceEth: formatEther(listing.price),
          blockNumber: 0,
        });
      } catch (err) {
        console.warn("[scanCollectionListings] index", i, "falló:", err);
      }
    }
  } catch (err) {
    console.warn(
      "[scanCollectionListings] totalSupply/tokenByIndex falló:",
      err?.message || err
    );
  }
  return items;
}

router.get("/listings", async (req, res) => {
  try {
    const { provider, market, nft } = await getContracts();
    const target = clampNumber(
      Number(req.query.target) || DEFAULT_BATCH_TARGET,
      {
        min: 1,
        max: MAX_LIMIT,
      }
    );
    const requestedCursor = Number(req.query.cursor);
    const hasCursor = Number.isFinite(requestedCursor);
    const cursor = hasCursor ? requestedCursor : null;
    const requestedMaxPages = clampNumber(
      Number(req.query.maxPages) || DEFAULT_MAX_PAGES,
      { min: 1, max: MAX_PAGE_CAP }
    );
    const shouldScan =
      req.query.scan === "true" || (!hasCursor && req.query.scan !== "false");

    const listings = [];
    const dedupe = new Map();
    const addListing = (item) => {
      const key = makeKey(item);
      if (dedupe.has(key)) return false;
      dedupe.set(key, item);
      listings.push(item);
      return true;
    };

    if (shouldScan) {
      const scanned = await scanCollectionListings(nft, market);
      for (const s of scanned) {
        addListing(s);
        if (listings.length >= target) break;
      }
    }

    const latestBlock = await provider.getBlockNumber();
    let toBlock = hasCursor ? cursor : latestBlock;
    let nextCursor = toBlock;
    let done = toBlock <= MARKET_DEPLOY_BLOCK;
    let pages = 0;
    let reachedTarget = listings.length >= target;

    while (!done && !reachedTarget && pages < requestedMaxPages) {
      const fromDesired = Math.max(
        MARKET_DEPLOY_BLOCK,
        toBlock - (BLOCK_PAGE - 1)
      );
      const { logs, usedFrom } = await fetchListedRange(
        market,
        fromDesired,
        toBlock
      );

      nextCursor = usedFrom - 1;
      for (const log of logs) {
        const { nft: nftAddr, tokenId, seller } = log.args;
        if ((nftAddr || "").toLowerCase() !== NFT_ADDRESS.toLowerCase()) {
          continue;
        }

        const tokenKey = makeKey({
          tokenId: tokenId.toString(),
          seller: (seller || "").toLowerCase(),
        });
        if (dedupe.has(tokenKey)) continue;

        try {
          const listing = await withRetry(() =>
            market.getListing(NFT_ADDRESS, tokenId)
          );
          if (listing.price <= 0n) continue;

          const meta = await resolveMetadata(nft, tokenId);
          const sellerLower = (listing.seller || seller || "").toLowerCase();
          addListing({
            tokenId: tokenId.toString(),
            name: meta?.name,
            description: meta?.description,
            image: meta?.image,
            seller: sellerLower,
            priceEth: formatEther(listing.price),
            blockNumber: log.blockNumber ?? usedFrom,
          });
          if (listings.length >= target) {
            reachedTarget = true;
            break;
          }
        } catch (err) {
          console.warn(
            "[/api/marketplace/listings] tokenId",
            tokenId?.toString(),
            "error:",
            err?.message || err
          );
        }
      }

      done = usedFrom <= MARKET_DEPLOY_BLOCK;
      toBlock = usedFrom - 1;
      pages += 1;

      if (!done && !reachedTarget && pages < requestedMaxPages) {
        await sleep(PAGE_DELAY_MS);
      }
    }

    const sorted = listings.sort(sortListings);
    const responseCursor = {
      nextTo: done ? MARKET_DEPLOY_BLOCK : Math.max(nextCursor, 0),
      done: done,
    };

    res.json({
      listings: sorted,
      cursor: responseCursor,
      meta: {
        target,
        returned: sorted.length,
        scanBootstrap: shouldScan,
        pagesUsed: pages,
      },
    });
  } catch (err) {
    console.error("[GET /api/marketplace/listings]", err);
    res.status(500).json({
      error: err?.message || "No se pudo cargar el marketplace global",
    });
  }
});

export default router;
