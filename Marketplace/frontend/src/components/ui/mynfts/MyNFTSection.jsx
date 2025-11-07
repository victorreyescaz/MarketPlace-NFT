import { Box, Heading, SimpleGrid, Skeleton, SkeletonText, Text } from "@chakra-ui/react";
import { DividerLine } from "../common/dividerLine";
import { OwnerNFTCard } from "../nft/NFTCard";

function LoadingSkeletons() {
  return (
    <>
      <DividerLine />
      <Heading size="lg">Mis NFTs</Heading>
      <SimpleGrid columns={[1, 2, 3]} spacing={5}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={`mynft-skel-${i}`} borderWidth="1px" borderRadius="lg" overflow="hidden" p="3">
            <Skeleton height="220px" />
            <Box mt="3">
              <Skeleton height="20px" width="70%" />
              <SkeletonText mt="2" noOfLines={2} spacing="2" />
              <Skeleton mt="2" height="14px" width="40%" />
              <Skeleton mt="3" height="32px" width="90px" />
            </Box>
          </Box>
        ))}
      </SimpleGrid>
    </>
  );
}

function EmptyState() {
  return (
    <>
      <DividerLine />
      <Heading size="lg">Mis NFTs</Heading>
      <Box p="6" borderWidth="1px" borderRadius="md" bg="blackAlpha.200">
        <Text>No tienes NFTs (o no en esta red).</Text>
      </Box>
    </>
  );
}

export function MyNFTSection({
  loadingNFTs,
  myNFTs,
  address,
  kCancel,
  txLoading,
  isTokenBusy,
  runWithLock,
  cancelListing,
  openUpdateModal,
  openListModal,
  isConnected,

}) {
  
  if (loadingNFTs && myNFTs.length === 0) {
    return <LoadingSkeletons />;
  }

  if (!loadingNFTs && myNFTs.length === 0 && isConnected) {
    return <EmptyState />;
  }

  if (myNFTs.length === 0) return null;

  return (
    <>
      <DividerLine />
      <Heading size="lg">Mis NFTs</Heading>
      <SimpleGrid columns={[1, 2, 3]} spacing={5}>
        {myNFTs.map((nft) => {
          const me = address?.toLowerCase?.() || "";
          const ownerLower = nft.owner?.toLowerCase?.() || "";
          const cancelKey = kCancel(nft.tokenId);

          return (
            <OwnerNFTCard
              key={`${nft.tokenId}-${ownerLower}`}
              nft={nft}
              isOwner={ownerLower === me}
              isBusy={isTokenBusy(nft.tokenId)}
              cancelLoading={!!txLoading[cancelKey]}
              onCancel={(item, event) => {
                const key = kCancel(item.tokenId);
                return runWithLock(key, event, async () => {
                  await cancelListing(item.tokenId);
                });
              }}
              onUpdatePrice={(item) => openUpdateModal(item.tokenId, item.priceEth, item.name)}
              onList={(item) => openListModal(item.tokenId, item.name)}
            />
          );
        })}
      </SimpleGrid>
    </>
  );
}
