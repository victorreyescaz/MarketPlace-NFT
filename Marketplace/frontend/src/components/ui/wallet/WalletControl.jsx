/*
Barra de acciones ligada a la wallet: recarga Mis NFTs, maneja proceeds y reinicia el marketplace global.

Se utiliza dentro del HeaderSection para agrupar todas las acciones relacionadas con la wallet del usuario.
 */

import { Button, VStack, Stack } from "@chakra-ui/react";

const WalletControls = ({
  isConnected,
  proceedsEth = "0",
  loadingNFTs = false,
  loadingMint = false,
  loadingGlobal = false,
  loadMyNFTs,
  mintForm,
  refreshProceeds,
  handleWithdraw,
  withdrawLoading = false,
  loadAllListings,
  showInfo,
  setQ = () => {},
  setMinP = () => {},
  setMaxP = () => {},
  setSort = () => {},
  onMyNFTButtonClick,
  onMintFormClick,
  showMyNFTs = false,
  showMint = false,
  onAfterAction,
}) => {

  const withAfter = (fn) => async (...args) => {
    await fn?.(...args);
    onAfterAction?.();
  };

  if (!isConnected) {
    return null;
  }

  return (
    <VStack spacing={4} align="stretch">
      <Stack direction={["column", "row"]} justify="center" flexWrap="wrap" spacing={3} alignContent={"stretch"}>

        <Button
          onClick={withAfter(onMintFormClick || (() => mintForm?.()))}
          isLoading={loadingMint}
          colorPalette={"blue"}
          variant={showMint ? "solid" : "outline"}
        >
          Mintear NFT
        </Button>
        <Button
          onClick={withAfter(onMyNFTButtonClick || (() => loadMyNFTs?.()))}
          isLoading={loadingNFTs}
          colorPalette="purple"
          variant={showMyNFTs ? "solid" : "outline"}
        >
          Mis NFTs
        </Button>

        <Button
          onClick={withAfter(async () => {
            await refreshProceeds();
            showInfo("Saldo actualizado con éxito");
          })}
          variant="outline"
        >
          Actualizar saldo
        </Button>

        <Button
          onClick={withAfter(handleWithdraw)}
          isDisabled={withdrawLoading || Number(proceedsEth) <= 0}
          isLoading={withdrawLoading}
        >
          Retirar {proceedsEth} ETH
        </Button>

        <Button
          colorPalette="orange"
          isDisabled={loadingGlobal}
          onClick={withAfter(() =>{
            setQ("");
            setMinP("");
            setMaxP("");
            setSort("recent");
            loadAllListings(true);
          })}
        >
          Marketplace Global
        </Button>
      </Stack>
    </VStack>
  );
};

export default WalletControls;
