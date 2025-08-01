export const fetchListedItems = async () => {
  try {
    const contract = await appKit.getContract("NFTMarketplace");
    const items = await contract.read.getAllListedItems();
    return items;
  } catch (error) {
    console.error("Error al obtener los NFTs listados:", error);
    return [];
  }
};
