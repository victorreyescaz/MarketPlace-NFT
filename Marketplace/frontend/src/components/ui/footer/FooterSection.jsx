import { Box, Link, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { DividerLine } from "../common/dividerLine";

export function FooterSection() {
  const year = new Date().getFullYear();

  return (
    <Box
      as="footer"
      bg="gray.900"
      color="gray.200"
      borderRadius="lg"
      p={8}
      mt={10}
      boxShadow="lg"
    >
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} p={2}>
        <Stack spacing={3} p={2}>
          <Text fontWeight="bold" fontSize="lg">
            Marketplace NFT
          </Text>
          <Text fontSize="sm">
            Compra, lista y mintea NFTs soportados en Sepolia. Mantente atento a las condiciones de gas
            y recuerda verificar cada contrato antes de interactuar.
          </Text>
        </Stack>

        <Stack spacing={8} fontSize="sm" p={2}>
          <Text fontWeight="semibold">Recursos</Text>
          <Link href="https://docs.alchemy.com/reference" isExternal color="blue.200">
            Documentación del backend
          </Link>
          <Link href="https://sepolia.etherscan.io/" isExternal color="blue.200">
            Etherscan Sepolia
          </Link>
          <Link href="mailto:soporte@nft-market.io" color="blue.200">
            soporte@nft-market.io
          </Link>
        </Stack>

        <Stack spacing={8} fontSize="sm" p={2}>
          <Text fontWeight="semibold">Contrato</Text>
          <Text color="gray.400">0x1234…ABCD</Text>
          <Text>
            Estado de conexión y retiros se sincronizan automáticamente.
          </Text>
        </Stack>
      </SimpleGrid>

      <DividerLine my={6} borderColor="gray.700" />
      <Text fontSize="xs" color="gray.500" textAlign="center">
        © {year} NFT Marketplace · Construido para la comunidad
      </Text>
    </Box>
  );
}
