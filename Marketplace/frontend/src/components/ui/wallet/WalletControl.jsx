/*
Barra de acciones ligada a la wallet: conecta/desconecta, recarga Mis NFTs, maneja proceeds y reinicia el marketplace global.

Se utiliza dentro del HeaderSection para agrupar todas las acciones relacionadas con la wallet del usuario.
 */

import { Button, VStack, HStack, Text } from "@chakra-ui/react";
import {
  AppKitConnectButton,
  AppKitAccountButton,
} from "@reown/appkit/react";

const WalletControls = ({
  isConnected,
  proceedsEth = "0",
  loadingNFTs = false,
  loadingGlobal = false,
  loadMyNFTs,
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
  showMyNFTs = false,
}) => {

  return (
    <VStack spacing={4} align="stretch">
      {!isConnected ? (
        <>
          <AppKitConnectButton
            namespace="eip155"
            size="lg"
            label="Conectar Wallet"
            loadingLabel="Conectando..."
          />
        </>
      ) : (
        <>
          <HStack justify="space-between" flexWrap="wrap" spacing={3} alignContent={"stretch"}>
            <AppKitAccountButton namespace="eip155" balance="show" />
 
            <Button
              onClick={onMyNFTButtonClick || (() => loadMyNFTs?.())}
              isLoading={loadingNFTs}
              colorScheme="purple"
              variant={showMyNFTs ? "solid" : "outline"}
            >
              Mis NFTs
            </Button>

            <Button onClick = {async () => {
              await refreshProceeds();
              showInfo("Saldo actualizado con éxito");
            }}
              variant="outline">
              Actualizar saldo
            </Button>

            <Button onClick={handleWithdraw} isDisabled={withdrawLoading || Number(proceedsEth) <= 0} isLoading={withdrawLoading}>
              Retirar {proceedsEth} ETH
            </Button>

            <Button
              colorScheme="orange"
              isDisabled={loadingGlobal}
              onClick={() => {
                setQ("");
                setMinP("");
                setMaxP("");
                setSort("recent");
                loadAllListings(true);
              }}
            >
              Marketplace Global
            </Button>
          </HStack>
        </>
      )}
    </VStack>
  );
};

export default WalletControls;
