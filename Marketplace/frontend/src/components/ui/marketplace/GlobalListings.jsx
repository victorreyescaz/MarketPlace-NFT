/**
Muestra el grid paginado de NFTs listados globalmente, incluyendo skeletons, botón de “Cargar más” y lógica para comprar con locks.

Renderiza los resultados del Marketplace Global
 */

import {
  Box,
  Button,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Text,
} from "@chakra-ui/react";

import { MarketplaceNFTCard } from "../nft/NFTCard";

const DEFAULT_SKELETONS = 6;

function GlobalSkeletonCard() {
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

export function GlobalListings({
  loadingGlobal,
  filteredGlobal,
  globalCursor,
  allListings,
  address,
  txLoading,
  kBuy,
  isTokenBusy,
  runWithLock,
  buyToken,
  loadAllListings,
  skeletonCount = DEFAULT_SKELETONS,
  ethPrice,

}) {
  
  const me = address?.toLowerCase?.() || "";

  if (loadingGlobal && filteredGlobal.length === 0) {
    return (
      <SimpleGrid columns={[1, 2, 3, 4]} spacing={5}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <GlobalSkeletonCard key={`global-skel-${i}`} />
        ))}
      </SimpleGrid>
    );
  }

  if (filteredGlobal.length === 0) {
    return (
      <Box p="6" borderWidth="1px" borderRadius="md" bg="blackAlpha.200">
        <Text>No hay listados (o no coinciden con los filtros).</Text>
      </Box>
    );
  }

  return (
    <>
      <SimpleGrid columns={[1, 2, 3, 4]} spacing={5} gap={2}>
        {filteredGlobal.map((nft) => {
          const cantBuy = (nft.seller || "").toLowerCase() === me;
          const buyKey = kBuy(nft.tokenId);

          return (
            <MarketplaceNFTCard
              key={`${nft.tokenId}-${nft.seller}`}
              nft={nft}
              ethPrice={ethPrice}
              cantBuy={cantBuy}
              isBusy={isTokenBusy(nft.tokenId)}
              buyLoading={!!txLoading[buyKey]}
              onBuy={(event) =>
                runWithLock(buyKey, event, () =>
                  buyToken(String(nft.tokenId), nft.priceEth, nft.seller)
                )
              }
            />
          );
        })}

        {loadingGlobal &&
          Array.from({ length: 3 }).map((_, i) => (
            <GlobalSkeletonCard key={`global-skel-inline-${i}`} />
          ))}
      </SimpleGrid>

      {!globalCursor?.done && allListings.length > 0 && (
        <Button
          onClick={() => loadAllListings(false)}
          isLoading={loadingGlobal}
          variant="outline"
          mt={4}
        >
          Cargar más
        </Button>
      )}

      {allListings.length > 0 && globalCursor?.done && (
        <Text mt="4" textAlign="center" color="gray.400" fontWeight={"bold"}>
          Has llegado al inicio del deploy. No hay más listados antiguos.
        </Text>
      )}
    </>
  );
}
