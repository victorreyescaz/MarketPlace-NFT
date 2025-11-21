/*
Modal controlado para listar/actualizar precio de un NFT, captura un precio en ETH y ejecuta `onConfirm`(devuelto por el hook usePriceModal) deshabilitando botones mientras envía.

Tambien hace la conversion bidireccional ETH-USD y ofrece la posibilidad de introducir el precio en una divisa u otra
 */

import { useEffect, useState } from "react";
import { Box, Button, Heading, HStack, Input, Text } from "@chakra-ui/react";
import { useEthUsdConversion } from "../../../hooks/useEthUsdConversion";

export function PriceModal({
  isOpen,
  mode,
  name,
  defaultPriceEth,
  defaultPriceDolar,
  onClose,
  onConfirm,
  
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    priceEth,
    priceUsd: priceDolar,
    onChangeEth,
    onChangeUsd,
    usdPerEth,
    priceLoading,
    priceError,
    reset: resetConversion,
  } = useEthUsdConversion({
    initialEth: defaultPriceEth ?? "",
    initialUsd: defaultPriceDolar ?? "",
  });

  useEffect(() => {
    if (isOpen) {
      resetConversion({
        eth: defaultPriceEth ?? "",
        usd: defaultPriceDolar ?? "",
      });
      setIsSubmitting(false);
    }
  }, [defaultPriceDolar, defaultPriceEth, isOpen, resetConversion]);


  const handleConfirm = async () => {
    if (isSubmitting || priceLoading) return;
    setIsSubmitting(true);
    try{
      await onConfirm?.({ 
        eth: Number(priceEth),
      });
    } finally{
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const heading = mode === "list" ? "📌 Listar NFT" : "✏️ Actualizar precio";

  return (
    <Box
      position="fixed"
      inset="0"
      bg="blackAlpha.500"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex={1000}
    >
      <Box
        bg="black"
        p="6"
        borderRadius="md"
        minW={["90vw", "420px"]}
        borderWidth="1px"
        borderColor="gray.600"
        boxShadow="lg"
      >
        <Heading size="md" textAlign="center" color="white">
          {heading}
        </Heading>

        {name && (
          <Text mt="1" mb="4" textAlign="center" fontWeight="semibold" color="gray.300">
            {name}
          </Text>
        )}

        <Text mb="2">💰 Precio (ETH)</Text>
        <Input mb={"2"}
          value={priceEth}
          onChange={(e) => {
            onChangeEth(e.target.value);
          }}
          type="number"
          step="0.0001"
          min="0"
          bg="gray.700"
          color="white"
          _placeholder={{ color: "gray.400" }}
        />

        {usdPerEth && (
          <Text mt={1} fontSize={"sm"} color={"gray.400"} >
            1 ETH ≈ ${usdPerEth.toFixed(2)}
          </Text>
        )}

        {priceError && (
          <Text>
            No se pudo obtener la tasa en vivo. Ingresa solo el valor en ETH.
          </Text>
        )}

        <Text mb="2">💰 Precio ($)</Text>
        <Input mb={"2"}
          value={priceDolar}
          onChange={(e) => {
            onChangeUsd(e.target.value);
          }}
          type="number"
          step="0.01"
          min="0"
          bg="gray.700"
          color="white"
          _placeholder={{ color: "gray.400" }}
        />

        <HStack mt="4" justify="flex-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            colorPalette="blue"
            isLoading={isSubmitting}
            isDisabled={isSubmitting || priceLoading}
            onClick={handleConfirm}
          >
            Confirmar
          </Button>
        </HStack>
      </Box>
    </Box>
  );
}
