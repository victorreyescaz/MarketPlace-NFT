import React, { useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react"; // ✅ ESTE HOOK ES EL BUENO

const MarketplaceGallery = () => {
  const appKit = useAppKit(); // ✅ USA el hook dentro del componente
  const [nfts, setNfts] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!appKit || typeof appKit.getContract !== "function") {
        return; // sigue esperando
      }

      clearInterval(interval); // ya está listo

      try {
        const contract = await appKit.getContract("NFTMarketplace");
        const items = await contract.read.getAllListedItems();
        setNfts(items);
      } catch (error) {
        console.error("❌ Error al obtener los NFTs listados:", error);
      }
    }, 500); // intenta cada 500ms

    return () => clearInterval(interval);
  }, [appKit]);


  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">NFTs en el Marketplace</h1>
      {/* Aquí el renderizado */}
    </div>
  );
};

export default MarketplaceGallery;

