import { Box, HStack, Input, Text } from "@chakra-ui/react";

export function MarketplaceControls({
  q,
  minPrice,
  maxPrice,
  sort,
  onSearchChange,
  onMinChange,
  onMaxChange,
  onSortChange,
  resultsCount,

}) {
  
  return (
    <HStack spacing={3} flexWrap="wrap" mb={4}>
      <Input
        placeholder="Buscar (nombre, descripción, tokenId, seller)"
        value={q}
        onChange={(e) => onSearchChange?.(e.target.value)}
        maxW="360px"
      />
      <HStack>
        <Input
          placeholder="Precio min (ETH)"
          type="number"
          step="0.0001"
          value={minPrice}
          onChange={(e) => onMinChange?.(e.target.value)}
          maxW="160px"
        />
        <Input
          placeholder="Precio máx (ETH)"
          type="number"
          step="0.0001"
          value={maxPrice}
          onChange={(e) => onMaxChange?.(e.target.value)}
          maxW="160px"
        />
      </HStack>
      <Box
        as="select"
        value={sort}
        onChange={(e) => onSortChange?.(e.target.value)}
        maxW="220px"
        px={3}
        py={2}
        borderWidth="1px"
        borderRadius="md"
        background="black"
      >
        <option value="recent">Más recientes</option>
        <option value="price-asc">Precio: menor a mayor</option>
        <option value="price-desc">Precio: mayor a menor</option>
      </Box>
      <Text fontSize="sm" color="gray.400">
        {resultsCount} resultados
      </Text>
    </HStack>
  );
}
