import React from "react";
import { Heading, VStack } from "@chakra-ui/react";
import { StatusBanners } from "../status/StatusBanners";
import WalletControls from "../wallet/WalletControl";

export function HeaderSection({ title = "NFT Marketplace", walletProps }) {
  return (
    <VStack spacing={6} align="stretch">
      <Heading textAlign="center">{title}</Heading>
      <StatusBanners />
      <WalletControls {...walletProps} />
    </VStack>
  );
}
