/*
`OwnerNFTCard` y `MarketplaceNFTCard` – tarjetas UI para mostrar NFTs propios o globales, con acciones como listar, cancelar, actualizar precio o comprar.

---- `OwnerNFTCard` recibe el NFT del usuario y muestra imagen, datos y botones según esté listado: si ya lo está, muestra precio y permite cancelar o cambiar precio (solo para el dueño); si no, ofrece “Listar”

---- `MarketplaceNFTCard` se usa en el marketplace global: muestra seller abreviado, precio y un botón “Comprar” que se desactiva si el NFT es del propio usuario (cantBuy) o si está ocupado (isBusy).
 */

import { Box, Button, Heading, HStack, Image, Stack, Text } from "@chakra-ui/react";

export function OwnerNFTCard({
    nft,
    isOwner,
    isBusy,
    cancelLoading,
    listLoading,
    onCancel,
    onUpdatePrice,
    onList,

}) {
    if (!nft) return null;

    return(
        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
            <Image src={nft.image} alt={nft.name} />
            <Heading size="md" mt="2">{nft.name}</Heading>
            <Text fontSize="sm" color="gray.600">{nft.description}</Text>
            <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>

            <Stack mt="3" spacing={2}>
              {nft.listed ? (
            <>
                <Text>💰 {nft.priceEth} ETH</Text>
                {isOwner && (
                    <HStack>
                        <Button
                            size="sm"
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
}) {
  if (!nft) return null;

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
      <Image src={nft.image} alt={nft.name} />
      <Heading size="md" mt="2">{nft.name}</Heading>
      <Text fontSize="sm" color="gray.600">{nft.description}</Text>
      <Text fontSize="xs" color="gray.400">ID: {nft.tokenId}</Text>
      <Text>
        Vendedor: {sellerShort}
      </Text>
      <Text mt="1">💰 {nft.priceEth} ETH</Text>

      <Button
        size="sm"
        colorScheme="green"
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
