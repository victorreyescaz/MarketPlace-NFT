/*
 Compone el bloque completo del marketplace global, conectando filtros (`MarketplaceControls`) con el grid (`GlobalListings`) y sus acciones.

 Pasa a MarketplaceControls los filtros actuales y handlers, y a GlobalListings los datos/acciones para renderizar y paginar las tarjetas NFT
 */

import { VStack, Heading } from "@chakra-ui/react";
import { MarketplaceControls } from "./MarketplaceControls";
import { GlobalListings } from "./GlobalListings";
import { DividerLine } from "../common/dividerLine";

export function GlobalMarketplaceSection({
  filters,
  listings,
  actions,
  title = "Marketplace Global",
  ethPrice,

}) {
  
  const {
    q,
    minPrice,
    maxPrice,
    sort,
    onSearchChange,
    onMinChange,
    onMaxChange,
    onSortChange,
  } = filters;

  const {
    filteredGlobal,
    allListings,
    loadingGlobal,
    globalCursor,
  } = listings;

  const {
    address,
    txLoading,
    kBuy,
    isTokenBusy,
    runWithLock,
    buyToken,
    loadAllListings,
  } = actions;

  return (
    <VStack align="stretch" spacing={6}>
      <DividerLine />
      <Heading size="lg">{title}</Heading>

      <MarketplaceControls
        q={q}
        minPrice={minPrice}
        maxPrice={maxPrice}
        sort={sort}
        resultsCount={filteredGlobal.length}
        onSearchChange={onSearchChange}
        onMinChange={onMinChange}
        onMaxChange={onMaxChange}
        onSortChange={onSortChange}
      />

      <GlobalListings
        loadingGlobal={loadingGlobal}
        filteredGlobal={filteredGlobal}
        globalCursor={globalCursor}
        allListings={allListings}
        address={address}
        txLoading={txLoading}
        kBuy={kBuy}
        isTokenBusy={isTokenBusy}
        runWithLock={runWithLock}
        buyToken={buyToken}
        loadAllListings={loadAllListings}
        ethPrice={ethPrice}
      />
    </VStack>
  );
}
