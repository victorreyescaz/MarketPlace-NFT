/* 
Helpers Pinata
*/

import { formatEther } from "ethers";
import { NFT_ADDRESS } from "../utils/contract";
import { withRetry } from "./rpcs";

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
export async function scanCollectionListings(nft, market, maxScan = 200) {
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
        const listing = await withRetry(() =>
          market.getListing(NFT_ADDRESS, tokenId)
        );

        if (listing.price > 0n) {
          // La n indica que el 0 es un BigInt, ethers v6 devuelve todos los uint256 como BigInt, listing devuelve un objeto con el seller y el price(BigInt).  Evitamos errores de tipo

          let uri = await withRetry(() => nft.tokenURI(tokenId));
          if (uri.startsWith("ipfs://"))
            uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
          const meta = await withRetry(() => fetch(uri).then((r) => r.json()));
          let img = meta.image;
          if (img?.startsWith("ipfs://"))
            img = img.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
          items.push({
            tokenId: tokenId.toString(),
            name: meta.name,
            description: meta.description,
            image: img,
            seller: listing.seller,
            priceEth: formatEther(listing.price),
            blockNumber: 0, // no lo conocemos aquí; lo rellenarán los eventos si aparece
          });
        }
      } catch (e) {
        console.warn("[scan] index", i, "falló:", e?.message || e);
      }
    }
  } catch (e) {
    console.warn(
      "[scan] totalSupply/tokenByIndex no disponible:",
      e?.message || e
    );
  }
  return items;
}
