import { useCallback, useState } from "react";
import { Contract, formatEther } from "ethers";
import { getReadProvider, withRetry } from "../services/rpcs";
import {
  NFT_ADDRESS,
  NFT_IFACE,
  MARKET_ADDRESS,
  MARKET_IFACE,
} from "../utils/contract";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function useMyNFTs({ address, walletProvider, isConnected, showError }) {
  const [myNFTs, setMyNFTs] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [proceedsEth, setProceedsEth] = useState("0");

  const loadMyNFTs = useCallback(async () => {
    if (!isConnected || !address || !walletProvider) return;

    try {
      setLoadingNFTs(true);

      const provider = await getReadProvider(walletProvider);
      const nft = new Contract(NFT_ADDRESS, NFT_IFACE, provider);
      const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);

      const [net, codeNFT, codeMKT] = await Promise.all([
        provider.getNetwork(),
        provider.getCode(NFT_ADDRESS),
        provider.getCode(MARKET_ADDRESS),
      ]);

      console.log("ChainId:", Number(net.chainId));
      console.log("NFT has code?:", codeNFT !== "0x");
      console.log("MKT has code?:", codeMKT !== "0x");

      if (codeNFT === "0x") {
        alert("NFT_ADDRESS no contiene contrato en esta red");
      }
      if (codeMKT === "0x") {
        alert("MARKET_ADDRESS no contiene contrato en esta red.");
        return;
      }

      try {
        market.interface.getFunction("getListing");
        market.interface.getFunction("getProceeds");
        console.log("ABI Marketplace OK");
      } catch (e) {
        console.error("ABI Marketplace desactualizado:", e);
        alert(
          "ABI del Marketplace en src/abis/Marketplace.json no coincide con el deploy. Vuelve a copiar el array 'abi' del artifacts."
        );
        return;
      }

      const balanceBN = await withRetry(() => nft.balanceOf(address));
      const balance = Number(balanceBN);
      console.log("balanceOf(address):", balance);

      if (balance === 0) {
        setMyNFTs([]);
        try {
          const proceeds = await withRetry(() => market.getProceeds(address));
          setProceedsEth(formatEther(proceeds));
        } catch (e) {
          console.warn("getProceeds falló (sin bloquear la UI):", e);
        }
        return;
      }

      const tokenIds = [];
      for (let i = 0; i < balance; i++) {
        try {
          const id = await withRetry(
            () => nft.tokenOfOwnerByIndex(address, i),
            { attempts: 4, delayMs: 250 }
          );
          tokenIds.push(id);
        } catch (e) {
          console.warn("tokenOfOwnerByIndex failed at index", i, e);
          continue;
        }
        await sleep(120);
      }
      console.log(
        "tokenIds resolved:",
        tokenIds.map((x) => x.toString())
      );

      const items = [];
      for (const tokenIdBN of tokenIds) {
        const tokenId = tokenIdBN.toString();

        const [rawURI, owner, listing] = await Promise.all([
          withRetry(() => nft.tokenURI(tokenId)),
          withRetry(() => nft.ownerOf(tokenId)),
          withRetry(() => market.getListing(NFT_ADDRESS, tokenId)),
        ]);

        let uri = rawURI;
        if (uri.startsWith("ipfs://")) {
          uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        }
        const meta = await withRetry(() => fetch(uri).then((r) => r.json()));

        let img = meta.image;
        if (img?.startsWith("ipfs://")) {
          img = img.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        }

        const listed = listing.price > 0n;
        const priceEth = listed ? formatEther(listing.price) : null;

        items.push({
          tokenId,
          name: meta.name,
          description: meta.description,
          image: img,
          owner,
          listed,
          priceEth,
          seller: listing.seller,
        });

        await sleep(100);
      }

      setMyNFTs(items);

      try {
        const proceeds = await withRetry(() => market.getProceeds(address));
        setProceedsEth(formatEther(proceeds));
      } catch (e) {
        console.warn("getProceeds falló (sin bloquear la UI):", e);
      }
    } catch (err) {
      showError?.(err, "Error cargando tus NFTs");
    } finally {
      setLoadingNFTs(false);
    }
  }, [address, isConnected, showError, walletProvider]);

  return {
    myNFTs,
    setMyNFTs,
    loadingNFTs,
    proceedsEth,
    setProceedsEth,
    loadMyNFTs,
  };
}
