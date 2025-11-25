/*
Compone el encabezado comun con titulo, banners de estado y controles de wallet
*/

import {
  Heading,
  VStack,
  HStack,
  useDisclosure,
  useBreakpointValue,
  IconButton,
  DrawerRoot,
  DrawerBackdrop,
  DrawerPositioner,
  DrawerHeader,
  DrawerContent,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerTrigger,
} from "@chakra-ui/react";
import {LuAlignJustify} from "react-icons/lu"
import { StatusBanners } from "../status/StatusBanners";
import WalletControls from "../wallet/WalletControl";
import {
  AppKitAccountButton,
  AppKitConnectButton,
} from "@reown/appkit/react";
import { useRef } from "react";
import "@fontsource/permanent-marker/400.css";

export function HeaderSection({ title = "NFT Marketplace by Víctor", walletProps }) {
  const { isConnected } = walletProps ?? {};
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef(null);
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  return (
    <VStack spacing={6} align="stretch" p={2}>
      <HStack justify="space-between" align="center" flexWrap="wrap" spacing={4}>
        <Heading
          textAlign="left"
          fontSize={25}
          fontFamily="Permanent Marker, cursive"
          color={"blue.200"}
          fontWeight={"400"}
          p={5}
        >
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
        {/* El botón de menú solo en móvil, controlado por el DrawerTrigger */}
        {isMobile && (
          <DrawerRoot
            open={isOpen}
            onOpenChange={({ open }) => (open ? onOpen() : onClose())}
          >
            <DrawerTrigger asChild>
              <IconButton
                ref={btnRef}
                aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
                colorPalette={"blue"}
              >
                <LuAlignJustify/>
              </IconButton>
            </DrawerTrigger>

            <DrawerBackdrop />
            <DrawerPositioner>
              <DrawerContent>
                <DrawerCloseTrigger />
                <DrawerHeader>Acciones</DrawerHeader>
                <DrawerBody>
                  <WalletControls
                    {...walletProps}
                    onAfterAction={onClose}
                    onMintFormClick={() => {
                      walletProps?.onMintFormClick?.();
                      onClose();
                    }}
                    onMyNFTButtonClick={() => {
                      walletProps?.onMyNFTButtonClick?.();
                      onClose();
                    }}
                  />
                </DrawerBody>
              </DrawerContent>
            </DrawerPositioner>
          </DrawerRoot>
        )}
      </HStack>

      <StatusBanners />

      {!isMobile && <WalletControls {...walletProps} />}
    </VStack>
  );
}
