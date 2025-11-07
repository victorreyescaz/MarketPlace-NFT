import { useCallback } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import { getReadProvider, withRetry } from "../services/rpcs";
import {
  NFT_ADDRESS,
  NFT_IFACE,
  MARKET_ADDRESS,
  MARKET_IFACE,
} from "../utils/contract";

export function useMarketplaceActions({
  walletProvider,
  address,
  showError,
  showInfo,
  loadMyNFTs,
  setProceedsEth,
}) {
  const getSigner = useCallback(async () => {
    if (!walletProvider) {
      throw new Error("No hay wallet provider");
    }
    return (await new BrowserProvider(walletProvider)).getSigner();
  }, [walletProvider]);

  const ensureApprovalAll = useCallback(
    async (owner) => {
      const signer = await getSigner();
      const nft = new Contract(NFT_ADDRESS, NFT_IFACE, signer);

      try {
        nft.interface.getFunction("isApprovedForAll");
        nft.interface.getFunction("setApprovalForAll");
      } catch {
        throw new Error("ABI NFT sin isApprovedForAll/setApprovalForAll");
      }

      const approved = await withRetry(() =>
        nft.isApprovedForAll(owner, MARKET_ADDRESS)
      );
      if (approved) return;

      await nft.setApprovalForAll.staticCall(MARKET_ADDRESS, true);
      const gas = await nft.setApprovalForAll.estimateGas(MARKET_ADDRESS, true);
      const tx = await nft.setApprovalForAll(MARKET_ADDRESS, true, {
        gasLimit: (gas * 120n) / 100n,
      });
      await tx.wait();
    },
    [getSigner]
  );

  const listToken = useCallback(
    async (tokenId, priceEth) => {
      if (!priceEth) return;
      const signer = await getSigner();
      const me = (await signer.getAddress()).toLowerCase();

      await ensureApprovalAll(me);

      const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);
      try {
        market.interface.getFunction("listItem");
      } catch {
        alert("ABI Marketplace incorrecto");
        return;
      }

      const price = parseEther(String(priceEth));
      await market.listItem.staticCall(NFT_ADDRESS, tokenId, price);
      const gas = await market.listItem.estimateGas(
        NFT_ADDRESS,
        tokenId,
        price
      );
      const tx = await market.listItem(NFT_ADDRESS, tokenId, price, {
        gasLimit: (gas * 120n) / 100n,
      });

      await tx.wait();
      alert("✅ Listado creado");
      await loadMyNFTs?.();
    },
    [ensureApprovalAll, getSigner, loadMyNFTs]
  );

  const updateListing = useCallback(
    async (tokenId, priceEth) => {
      if (!priceEth) return;
      const signer = await getSigner();
      const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);
      const price = parseEther(String(priceEth));

      await market.updateListing.staticCall(NFT_ADDRESS, tokenId, price);
      const gas = await market.updateListing.estimateGas(
        NFT_ADDRESS,
        tokenId,
        price
      );
      const tx = await market.updateListing(NFT_ADDRESS, tokenId, price, {
        gasLimit: (gas * 120n) / 100n,
      });
      await tx.wait();
      alert("✅ Precio actualizado");
      await loadMyNFTs?.();
    },
    [getSigner, loadMyNFTs]
  );

  const cancelListing = useCallback(
    async (tokenId) => {
      const signer = await getSigner();
      const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);

      await market.cancelListing.staticCall(NFT_ADDRESS, tokenId);
      const gas = await market.cancelListing.estimateGas(NFT_ADDRESS, tokenId);
      const tx = await market.cancelListing(NFT_ADDRESS, tokenId, {
        gasLimit: (gas * 120n) / 100n,
      });
      await tx.wait();
      alert("✅ Listado cancelado");
      await loadMyNFTs?.();
    },
    [getSigner, loadMyNFTs]
  );

  const refreshProceeds = useCallback(async () => {
    if (!walletProvider || !address) return;
    try {
      const provider = await getReadProvider(walletProvider);
      const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, provider);
      const proceeds = await withRetry(() => market.getProceeds(address));
      setProceedsEth(formatEther(proceeds));
    } catch (e) {
      console.warn("getProceeds:", e);
    }
  }, [address, setProceedsEth, walletProvider]);

  const withdrawProceeds = useCallback(async () => {
    const signer = await getSigner();
    const market = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);

    await market.withdrawProceeds.staticCall();
    const gas = await market.withdrawProceeds.estimateGas();
    const tx = await market.withdrawProceeds({
      gasLimit: (gas * 120n) / 100n,
    });
    await tx.wait();
    alert("✅ Fondos retirados");
    await refreshProceeds();
  }, [getSigner, refreshProceeds]);

  const buyToken = useCallback(
    async (tokenId, priceEth, sellerFromCard) => {
      try {
        if (!walletProvider) {
          showError?.("Conecta tu wallet");
          return;
        }

        const me = (address || "").toLowerCase();
        if (sellerFromCard && sellerFromCard.toLowerCase() === me) {
          showError?.("No puedes comprar tu propio NFT");
          return;
        }

        const readProv = await getReadProvider(walletProvider);
        const marketR = new Contract(MARKET_ADDRESS, MARKET_IFACE, readProv);
        const listing = await marketR.getListing(NFT_ADDRESS, tokenId);
        const seller = (listing.seller || "").toLowerCase();

        if (listing.price === 0n) {
          showError?.("Este NFT ya no está listado.");
          return;
        }
        if (seller === me) {
          showError?.("No puedes comprar tu propio NFT");
          return;
        }

        const value = listing.price;
        const signer = await getSigner();
        const marketW = new Contract(MARKET_ADDRESS, MARKET_IFACE, signer);

        showInfo?.("Simulando compra…");
        await marketW.buyItem.staticCall(NFT_ADDRESS, tokenId, { value });

        const gas = await marketW.buyItem.estimateGas(NFT_ADDRESS, tokenId, {
          value,
        });
        const gasLimit = (gas * 120n) / 100n;

        showInfo?.("Enviando transacción…");
        const tx = await marketW.buyItem(NFT_ADDRESS, tokenId, {
          value,
          gasLimit,
        });

        showInfo?.("Procesando en la red…");
        await tx.wait();

        showInfo?.("✅ NFT comprado", 3000);
        await loadMyNFTs?.();
      } catch (err) {
        showError?.(err, "❌ Error al comprar");
      }
    },
    [address, getSigner, loadMyNFTs, showError, showInfo, walletProvider]
  );

  return {
    listToken,
    updateListing,
    cancelListing,
    buyToken,
    refreshProceeds,
    withdrawProceeds,
  };
}
