// ======== Helpers loadAllListings ========

// Arrow function que recibe un objeto it() y devuelve clave unica en formato String. tokenId-seller. Sirve para deduplicar en un Map (si llega el mismo NFT listado por el mismo seller, machaca la entrada anterior).
// Si el mismo token se vuelve a listar pero con otro seller(que previamente lo ha comprado) esta clave cambia
export const makeKey = (it) =>
  `${it.tokenId}-${(it.seller || "").toLowerCase()}`;

/*
Funcion que ordena los NFTs por blockNumber descendente
Si empatan (si los dos nfts se mintearon en el mismo bloque) los ordena por tokenId descendente
a y b son dos objetos de listings, dos NFTs con sus metadatos
*/

export function sortListings(a, b) {
  const ba = a.blockNumber ?? 0; // si a.blocknumber es undefined o null devuelve 0, sino devuelve a.blocknumber
  const bb = b.blockNumber ?? 0;

  if (bb !== ba) return bb - ba;
  return Number(b.tokenId || 0) - Number(a.tokenId || 0);
}

/*
Funcion que fusiona un batch con el estado previo sin duplicarlo. Evita duplicados cuando cargas mas listings
*/
export function mergeBatchIntoState(previousListings = [], batch = []) {
  if (!batch.length) {
    return Array.isArray(previousListings) ? previousListings : [];
  }

  const base = Array.isArray(previousListings) ? previousListings : [];
  const map = new Map(base.map((item) => [makeKey(item), item]));

  for (const it of batch) {
    map.set(makeKey(it), it);
  }

  return Array.from(map.values()).sort(sortListings);
}
