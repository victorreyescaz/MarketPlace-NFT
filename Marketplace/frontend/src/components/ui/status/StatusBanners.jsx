/*
Lee el contexto `useStatusBanner` para mostrar banners de error o información con botón de cierre manual.
 */

import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { useStatusBanner } from "../../../hooks/useStatusBanner";

export function StatusBanners() {
  const { uiError, setUiError, uiInfo, setUiInfo } = useStatusBanner();

  if (!uiError && !uiInfo) return null;

  return (
    <>
      {uiError && (
        <Box
          borderWidth="1px"
          borderColor="red.400"
          bg="red.500"
          color="white"
          p="3"
          borderRadius="md"
        >
          <HStack justify="space-between" align="start">
            <Text fontWeight="semibold">⚠️ {uiError}</Text>
            <Button size="xs" variant="outline" onClick={() => setUiError(null)}>
              Cerrar
            </Button>
          </HStack>
        </Box>
      )}

      {uiInfo && (
        <Box
          borderWidth="1px"
          borderColor="blue.400"
          bg="blue.500"
          color="white"
          p="3"
          borderRadius="md"
        >
          <HStack justify="space-between" align="start">
            <Text>ℹ️ {uiInfo}</Text>
            <Button size="xs" variant="outline" onClick={() => setUiInfo(null)}>
              Cerrar
            </Button>
          </HStack>
        </Box>
      )}
    </>
  );
}
