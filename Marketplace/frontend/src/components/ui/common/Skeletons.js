// ========= Helper indicadores de carga, mientras se cargan los nfts =========

import { Skeleton } from "@chakra-ui/react";

const GLOBAL_SKELETON_COUNT = 6; // nº de tarjetas skeleton en la primera carga

// Card placeholder para una NFT. Componente de React
function NFTCardSkeleton() {
  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
      <Skeleton height="220px" />
      <Box mt="3">
        <Skeleton height="20px" width="70%" /> {/* Simula el nombre del NFT */}
        <SkeletonText mt="2" noOfLines={2} spacing="2" />{" "}
        {/* Simula la descripcion */}
        <Skeleton mt="2" height="14px" width="40%" />{" "}
        {/* Simula direccion del seller */}
        <Skeleton mt="3" height="32px" width="90px" />{" "}
        {/* Simula el boton de accion (comprar) */}
      </Box>
    </Box>
  );
}

// Grid de skeletons para mantener el layout
function SkeletonGrid({ count = 6 }) {
  return (
    <SimpleGrid columns={[1, 2, 3]} spacing={5}>
      {" "}
      {/* Los NFTs se muestran de 3 en 3 (columnas) con una separacion (spacing) entre tarjetas. Grid responsive, con esto las tarjetas skeleton se adaptan al tamaño de la pantalla */}
      {/* Crea array vacio e itera sobre el, en cada iteracion renderiza un NFTCardSkeleton, hay que darle una key unica a cada elemento(requerido por React en listas) */}
      {Array.from({ length: count }).map((_, i) => (
        <NFTCardSkeleton key={i} />
      ))}
    </SimpleGrid>
  );
}

export { NFTCardSkeleton, SkeletonGrid };
