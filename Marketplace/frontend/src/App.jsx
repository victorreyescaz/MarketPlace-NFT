import React, {useCallback } from "react";
import { VStack } from "@chakra-ui/react";
import { useAppKitProvider, useAppKitAccount, useAppKit } from "@reown/appkit/react";
/* 
useAppKitProvider: te da el provider conectado (RPC + firmante según contexto).

useAppKitAccount: info de la cuenta (address conectada, chainId, estado conectado/desconectado).

useAppKit: control del modal (abrir/cerrar, etc.).
*/
import { ethers } from "ethers";
import { useStatusBanner } from "./components/ui/context/StatusBannerContext";
import { MintSection } from "./components/ui/mint/MintSection";
import { PriceModal } from "./components/ui/modals/PriceModal";
import { MyNFTSection } from "./components/ui/mynfts/MyNFTSection"
import { useTxLocks } from "./hooks/useTxLocks";
import { usePriceModal } from "./hooks/usePriceModal";
import { useMarketplaceActions } from "./hooks/useMarketplaceActions";
import { useMyNFTs } from "./hooks/useMyNFTs";
import { useGlobalListings } from "./hooks/useGlobalListings";
import { useWalletEvents } from "./hooks/useWalletEvents";
import { GlobalMarketplaceSection } from "./components/ui/marketplace/GlobalMarketplaceSection";
import { HeaderSection } from "./components/ui/header/HeaderSection";
import { useMarketplaceAutoload } from "./hooks/useMarketplaceAutoload";



function App() {

  const { walletProvider } = useAppKitProvider("eip155");
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { open } = useAppKit();

  const {showError, showInfo} = useStatusBanner();

  const {
    myNFTs,
    setMyNFTs,
    loadingNFTs,
    proceedsEth,
    setProceedsEth,
    loadMyNFTs: loadMyNFTsCore,
  } = useMyNFTs({
    address,
    walletProvider,
    isConnected,
    showError,
  });

  const {
    allListings,
    filteredGlobal,
    loadingGlobal,
    globalCursor,
    loadAllListings: loadAllListingsCore,
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
  } = useGlobalListings({ walletProvider, showError, showInfo });

  const marketplaceFilters = {
    q,
    minPrice: minP,
    maxPrice: maxP,
    sort,
    onSearchChange: setQ,
    onMinChange: setMinP,
    onMaxChange: setMaxP,
    onSortChange: setSort,
  };

  const loadMyNFTs = useCallback(async () => {
    clearListings();
    await loadMyNFTsCore();
  }, [clearListings, loadMyNFTsCore]);

  const loadAllListings = useCallback(
    async (...args) => {
      setMyNFTs([]);
      await loadAllListingsCore(...args);
    },
    [loadAllListingsCore, setMyNFTs]
  );

  const txLock = useTxLocks();
  const { txLoading, kBuy, kCancel, kList, kUpdate, isTokenBusy, runWithLock, setLoading } = txLock;

  const marketplaceActionsHook = useMarketplaceActions({
    walletProvider,
    address,
    showError,
    showInfo,
    loadMyNFTs,
    setProceedsEth,
  });

  const { listToken, updateListing, cancelListing, buyToken, refreshProceeds, withdrawProceeds } =
    marketplaceActionsHook;

  const marketplaceListings = {
    filteredGlobal,
    allListings,
    loadingGlobal,
    globalCursor,
  };

  const marketplaceActions = {
    address,
    txLoading,
    kBuy,
    isTokenBusy,
    runWithLock,
    buyToken,
    loadAllListings,
  };

  const walletProps = {
    isConnected,
    address,
    openWalletModal: open,
    loadMyNFTs,
    loadingNFTs,
    refreshProceeds,
    withdrawProceeds,
    proceedsEth,
    loadAllListings,
    loadingGlobal,
    globalCursor,
    resetFilters,
  };

  const {
    modalState: priceModal,
    openList: openListModal,
    openUpdate: openUpdateModal,
    close: closePriceModal,
    confirm: confirmPrice,
  } = usePriceModal(myNFTs, {
    listToken,
    updateListing,
    setLoading,
    kList,
    kUpdate,
  });

    useMarketplaceAutoload({
    walletProvider,
    resetFilters,
    loadAllListings,
  });

    // Funciones que controlan la apertura y cierre del modal de precio usado para listar o actualizar NFTs en el marketplace
  useWalletEvents({
    walletProvider,
    onAccountsChanged: async (accounts) => {
      if (!accounts || accounts.length === 0) {
        address(null);
        isConnected(false);
        setMyNFTs([]);
        return;
      }
      const newAddress = accounts[0].toLowerCase();
      address(newAddress);
      await loadMyNFTs();
      await refreshProceeds();
    },
    onChainChanged: async (chainId) => {
      console.log("Red cambiada a:", chainId);
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      walletProvider(newProvider);
      await loadAllListings(true);
      await loadMyNFTs();
      await refreshProceeds();
    },
  });


  /* ===================================================== Render ======================================================================  */ 

return (
  <VStack spacing={6} p={10} align="stretch" maxW="1000px" mx="auto">
    <HeaderSection walletProps={walletProps} />

    {/* Formulario de minteo*/}
    
    <MintSection
      walletProvider={walletProvider}
      isConnected={isConnected}
      open={open}
      showError={showError}
      showInfo={showInfo}
    />

    {/* Carga galería (Mis NFTs)*/}

      <MyNFTSection
      loadingNFTs={loadingNFTs}
      myNFTs={myNFTs}
      address={address}
      kCancel={kCancel}
      txLoading={txLoading}
      isTokenBusy={isTokenBusy}
      runWithLock={runWithLock}
      cancelListing={cancelListing}
      openUpdateModal={openUpdateModal}
      openListModal={openListModal}
      isConnected={isConnected}
    />

    <GlobalMarketplaceSection
      filters={marketplaceFilters}
      listings={marketplaceListings}
      actions={marketplaceActions}
    />

{/* === Modal de precio inline para listar o actualizar precio NFT  === */}

<PriceModal
  isOpen={priceModal?.isOpen}
  mode={priceModal?.mode}
  name={priceModal?.name}
  defaultPrice={priceModal?.defaultPrice}
  onClose={closePriceModal}
  onConfirm={confirmPrice}
/>

  </VStack>
);

}

export default App;
