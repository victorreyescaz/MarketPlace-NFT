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
  globalCursor = { done: true },
  loadMyNFTs,
  refreshProceeds,
  withdrawProceeds,
  loadAllListings,
  showInfo,
  setQ = () => {},
  setMinP = () => {},
  setMaxP = () => {},
  setSort = () => {},
}) => {
  const cursorDone = globalCursor?.done ?? true;

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
          <HStack justify="space-between" flexWrap="wrap" spacing={3}>
            <AppKitAccountButton namespace="eip155" balance="show" />
 
            <Button
              onClick={() => loadMyNFTs?.()}
              isLoading={loadingNFTs}
              colorScheme="purple"
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

            <Button onClick={withdrawProceeds} isDisabled={Number(proceedsEth) <= 0}>
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

            {!cursorDone && (
              <Button
                onClick={() => loadAllListings(false)}
                isLoading={loadingGlobal}
                isDisabled={loadingGlobal}
                variant="outline"
              >
                Cargar más
              </Button>
            )}
          </HStack>
        </>
      )}
    </VStack>
  );
};

export default WalletControls;
