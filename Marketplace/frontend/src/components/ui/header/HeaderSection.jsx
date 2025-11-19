/*
Compone el encabezado comun con titulo, banners de estado y controles de wallet
*/

import { Heading, VStack, HStack } from "@chakra-ui/react";
import { StatusBanners } from "../status/StatusBanners";
import WalletControls from "../wallet/WalletControl";
import {
  AppKitAccountButton,
  AppKitConnectButton,
} from "@reown/appkit/react";

export function HeaderSection({ title = "NFT Marketplace", walletProps }) {
  const { isConnected } = walletProps ?? {};

  return (
    <VStack 
    spacing={6} 
    align="stretch"
    bgColor="black"
    p={2}
    >
      <HStack justify="space-between" align="center" flexWrap="wrap" spacing={4}>
        <Heading textAlign="left" fontSize={25} color={"blue.200"} fontWeight={"bold"}>
          {title}
        </Heading>
        {isConnected ? (
          <AppKitAccountButton namespace="eip155" balance="show" />
        ) : (
          <AppKitConnectButton
            namespace="eip155"
            size="lg"
            label="Conectar Wallet"
            loadingLabel="Conectando..."
          />
        )}
      </HStack>
      <StatusBanners />
      <WalletControls {...walletProps} />
    </VStack>
  );
}
