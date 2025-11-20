/*
`OwnerNFTCard` y `MarketplaceNFTCard` – tarjetas UI para mostrar NFTs propios o globales, con acciones como listar, cancelar, actualizar precio o comprar.

---- `OwnerNFTCard` recibe el NFT del usuario y muestra imagen, datos y botones según esté listado: si ya lo está, muestra precio y permite cancelar o cambiar precio (solo para el dueño); si no, ofrece “Listar”

---- `MarketplaceNFTCard` se usa en el marketplace global: muestra seller abreviado, precio y un botón “Comprar” que se desactiva si el NFT es del propio usuario (cantBuy) o si está ocupado (isBusy).
 */

import { Box, Button, Center, Flex, Heading, HStack, Image, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "../tooltip";

const formatUsd = (eth, usd) => {
  if (!usd || !eth) return null;
  const total = Number(eth) * usd;
  return `≈ $${total.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
};

export function OwnerNFTCard({
    nft,
    isOwner,
    isBusy,
    cancelLoading,
    listLoading,
    onCancel,
    onUpdatePrice,
    onList,
    ethPrice,
}) {
    if (!nft) return null;

    const priceData = ethPrice ?? {};
    const usdLabel = priceData.loading
      ? "Actualizando precio USD…"
      : priceData.error
        ? "No se pudo obtener el precio en USD"
        : formatUsd(nft.priceEth, priceData.priceUsd);

    return(
        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p={3}>
          <Box height= "250px" width="100%" bg="gray.900" display="flex" alignItems="center" justifyContent= "center">
            <Image src={nft.image} alt={nft.name} width="100%" height="100%" objectFit={"contain"}/>
          </Box>
          <Heading size="md" mt="2">{nft.name}</Heading>
          <Text fontSize="sm" color="gray.600">{nft.description}</Text>
          <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>

          <Stack mt="3" spacing={2}>
            {nft.listed ? (
          <>
              <Tooltip content={usdLabel} disabled={!usdLabel} openDelay={150}>
                <Text mt="1">💰 {nft.priceEth} ETH</Text>
              </Tooltip>
              {isOwner && (
                  <HStack justify={"center"}>
                      <Button
                          size="sm"
                          colorPalette="red"
                          isLoading={cancelLoading}
                          isDisabled={isBusy}
                          onClick={(e) => onCancel?.(nft, e)}>
                      Cancelar
                      </Button>

                      <Button
                      size="sm"
                      onClick= {() => onUpdatePrice?.(nft)}>
                      Cambiar precio
                      </Button>
                  </HStack>
              )}
          </>
        ) : (
                isOwner && (
                    <Button
                        size="sm"
                        colorPalette="purple"
                        isDisabled={isBusy || listLoading}
                        isLoading={listLoading}
                        onClick={() => onList?.(nft)}>
                    Listar
                  </Button>
                )
              )}
            </Stack>
        </Box>
    )
}



export function MarketplaceNFTCard({
  nft,
  cantBuy,
  isBusy,
  buyLoading,
  onBuy,
  ethPrice,
}) {
  if (!nft) return null;

  const priceData = ethPrice ?? {};
  const usdLabel = priceData.loading
  ? "Actualizando precio USD…"
  : priceData.error
    ? "No se pudo obtener el precio en USD"
    : formatUsd(nft.priceEth, priceData.priceUsd);

  const sellerShort = nft.seller
    ? `${nft.seller.slice(0, 6)}...${nft.seller.slice(-4)}`
    : "Desconocido";

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      p="3"
    >
      <Box height= "250px" width="100%" bg="gray.900" display="flex" alignItems="center" justifyContent= "center">
        <Image src={nft.image} alt={nft.name} width="100%" height="100%" objectFit={"contain"} />
      </Box>
      <Heading size="md" mt="2">{nft.name}</Heading>
      <Text fontSize="sm" color="gray.600">{nft.description}</Text>
      <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>
      <Text>
        Vendedor: {sellerShort}
      </Text>
      <Tooltip content={usdLabel} disabled={!usdLabel} openDelay={150}>
        <Text mt="1">💰 {nft.priceEth} ETH</Text>
      </Tooltip>

      <Button
        size="sm"
        colorPalette="green"
        mt="2"
        isLoading={buyLoading}
        isDisabled={cantBuy || isBusy}
        aria-busy={buyLoading}
        style={isBusy ? { pointerEvents: "none" } : undefined} // style para que se vea pointer raton prohibicion
        title={cantBuy ? "No puedes comprar tu propio NFT" : undefined}
        onClick={onBuy}
      >
        {cantBuy ? "Tu NFT" : "Comprar"}
      </Button>
    </Box>
  );
}
