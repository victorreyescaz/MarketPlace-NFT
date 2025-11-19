/*
Modal controlado para listar/actualizar precio de un NFT, captura un precio en ETH y ejecuta `onConfirm`(devuelto por el hook usePriceModal) deshabilitando botones mientras envía.
 */

import { useEffect, useState } from "react";
import { Box, Button, Heading, HStack, Input, Text } from "@chakra-ui/react";

export function PriceModal({
  isOpen,
  mode,
  name,
  defaultPrice,
  onClose,
  onConfirm,
  
}) {
  const [price, setPrice] = useState(defaultPrice ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrice(defaultPrice ?? "");
      setIsSubmitting(false);
    }
  }, [defaultPrice, isOpen]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try{
      await onConfirm?.(price);
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
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          step="0.0001"
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
            isDisabled={isSubmitting}
            onClick={handleConfirm}
          >
            Confirmar
          </Button>
        </HStack>
      </Box>
    </Box>
  );
}
