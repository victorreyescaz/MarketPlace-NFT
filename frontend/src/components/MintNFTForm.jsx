import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAppKit } from "@reown/appkit/react";

const MintNFTForm = () => {
  const appKit = useAppKit();

console.log("AppKit:", appKit);
console.log("isReady:", typeof appKit.isReady === "function" ? appKit.isReady() : "No disponible");
console.log("Contracts:", appKit.contracts);


  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    
    const checkReady = async () => {
      if (appKit && typeof appKit.isReady === "function") {
        const isReady = await appKit.isReady();
        setReady(isReady);
      }
    };
    checkReady();
  }, [appKit]);

  const handleMint = async (e) => {
    e.preventDefault();

    if (!ready) {
      alert("AppKit aún no está listo. Espera unos segundos y vuelve a intentarlo.");
      return;
    }

    setLoading(true);

    try {
      // Subir imagen a IPFS (Pinata)
      const formData = new FormData();
      formData.append("file", image);

      const resImg = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          maxContentLength: "Infinity",
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
          },
        }
      );

      const imageHash = resImg.data.IpfsHash;
      const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageHash}`;

      // Crear metadatos
      const metadata = { name, image: imageUrl };

      const resMeta = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        metadata,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
          },
        }
      );

      const tokenURI = `https://gateway.pinata.cloud/ipfs/${resMeta.data.IpfsHash}`;

      // Llamar al contrato
      const contract = await appKit.getContract("NFTMarketplace");
      const parsedPrice = BigInt(Number(price) * 1e18);

      const tx = await contract.write.createToken([tokenURI, parsedPrice], {
        value: BigInt(1e16),
      });

      await tx.wait();
      alert("NFT minteado y listado con éxito!");
    } catch (error) {
      console.error("Error al mintear NFT:", error);
      alert("Hubo un error al mintear. Revisa consola.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleMint} className="p-8 bg-white rounded shadow space-y-4">
      <h2 className="text-xl font-semibold">Mintea tu NFT</h2>

      <input
        type="text"
        placeholder="Nombre del NFT"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="Precio en ETH"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
        className="w-full p-2 border rounded"
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files[0])}
        required
        className="w-full"
      />

      <button
        type="submit"
        disabled={loading || !ready}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Minteando..." : "Mintear NFT"}
      </button>
    </form>
  );
};

export default MintNFTForm;
