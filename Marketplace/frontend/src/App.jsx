import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, VStack } from "@chakra-ui/react";
import { useAppKitProvider, useAppKitAccount, useAppKit } from "@reown/appkit/react";
/* 
useAppKitProvider: te da el provider conectado (RPC + firmante según contexto).

useAppKitAccount: info de la cuenta (address conectada, chainId, estado conectado/desconectado).

useAppKit: control del modal (abrir/cerrar, etc.).
*/
import { useStatusBanner } from "./hooks/useStatusBanner";
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
import { ethers } from "ethers";



function App() {

  const { walletProvider } = useAppKitProvider("eip155");
  const { address, isConnected, chainId } = useAppKitAccount({ namespace: "eip155" });
  const { open } = useAppKit();

  const SUPPORTED_CHAINS_IDS = new Set([11155111]);
  const wrongNetwork = isConnected && chainId && !SUPPORTED_CHAINS_IDS.has(Number(chainId));

  // Provider publico que usaremos para mostrar el Marketplace Global cuando no haya una wallet conectada
  const READ_RPC = import.meta.env.READ_RPC;

  const publicProvider = useMemo(() => 
    READ_RPC ? new ethers.JsonRpcProvider(READ_RPC):null, [READ_RPC]);

  const readProvider = walletProvider ?? publicProvider;
  const preferBackend = !walletProvider && !READ_RPC;

  const [showMyNFTs, setShowMyNFTs] = useState(false);

  const {showError, showInfo} = useStatusBanner(); 

  const {
    myNFTs,
    setMyNFTs,
    loadingNFTs,
    proceedsEth,
    setProceedsEth,
    loadMyNFTs,
  } = useMyNFTs({
    address,
    walletProvider,
    isConnected,
    showError,
  });

  const handleMyNFTButtonClick = () => {
    if (!showMyNFTs) {
      setShowMyNFTs(true);
    }
    loadMyNFTs?.();
  };

  const handleHideMyNFTs = () => {
    setShowMyNFTs(false);
  }

  const {
    allListings,
    filteredGlobal,
    loadingGlobal,
    globalCursor,
    loadAllListings,
    q,
    minP,
    maxP,
    sort,
    setQ,
    setMinP,
    setMaxP,
    setSort,
    resetFilters,
  } = useGlobalListings({ walletProvider: readProvider, preferBackend, showError, showInfo });

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

  const txLock = useTxLocks();
  const { txLoading, kBuy, kCancel, kList, kUpdate, isTokenBusy, runWithLock, setLoading } = txLock;

  const marketplaceActionsHook = useMarketplaceActions({
    walletProvider,
    address,
    showError,
    showInfo,
    loadMyNFTs,
    loadAllListings,
    setProceedsEth,
  });

  const { listToken, updateListing, cancelListing, buyToken, refreshProceeds, withdrawProceeds } =
    marketplaceActionsHook;

  const withdrawLockKey = "wallet:withdraw";
  const handleWithdraw = useCallback((evt) => runWithLock(withdrawLockKey, evt, withdrawProceeds),
  [runWithLock, withdrawProceeds]
  );
  const withdrawLoading = !!txLoading[withdrawLockKey];

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
    handleWithdraw,
    withdrawLoading,
    proceedsEth,
    loadAllListings,
    loadingGlobal,
    globalCursor,
    showInfo,
    setQ,
    setMinP,
    setMaxP,
    setSort,
    onMyNFTButtonClick: handleMyNFTButtonClick,
    showMyNFTs,
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
    walletProvider: readProvider,
    resetFilters,
    loadAllListings,
    allowBackend: preferBackend,
  });

    useWalletEvents({
      walletProvider,
      onAccountsChanged: async (accounts) => {
        if (!accounts?.length) {
          setMyNFTs([]);
          return;
        }
        await loadMyNFTs(accounts[0]);
        await refreshProceeds();
      },
      onChainChanged: async () => {
        await loadAllListings(true);
        await loadMyNFTs();
        await refreshProceeds();
      },
    });

    useEffect(() => {
      if (!walletProvider || !address || !isConnected) return;
      loadMyNFTs();
      refreshProceeds();
    }, [address, walletProvider, isConnected, loadMyNFTs, refreshProceeds]);

    useEffect(() => {
      if (wrongNetwork){
        showError("Cambia a la red de Sepolia para operar en el marketplace");
      }
    },[wrongNetwork, showError]);

  /* ========================== Render =================================*/ 

return (
  <VStack spacing={6} p={10} align="stretch" maxW="1000px" mx="auto">

    <Box position="sticky" top={0} zIndex={10} bg="gray.900" p={3}>
    <HeaderSection walletProps={walletProps} />
    </Box>

    {/* Formulario de minteo*/}
    
    <MintSection
      walletProvider={walletProvider}
      isConnected={isConnected}
      open={open}
      showError={showError}
      showInfo={showInfo}
      wrongNetwork={wrongNetwork}
      listToken={listToken}
      loadMyNFTs={loadMyNFTs}
    />

    {/* Carga galería (Mis NFTs)*/}

    {showMyNFTs && (
      <MyNFTSection
      loadingNFTs={loadingNFTs}
      myNFTs={myNFTs}
      address={address}
      kCancel={kCancel}
      kList={kList}
      txLoading={txLoading}
      isTokenBusy={isTokenBusy}
      runWithLock={runWithLock}
      cancelListing={cancelListing}
      openUpdateModal={openUpdateModal}
      openListModal={openListModal}
      isConnected={isConnected}
      wrongNetwork={wrongNetwork}
      onClose={handleHideMyNFTs}
      />
    )}

    <GlobalMarketplaceSection
      filters={marketplaceFilters}
      listings={marketplaceListings}
      actions={marketplaceActions}
      wrongNetwork={wrongNetwork}
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
