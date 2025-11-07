import { useCallback, useState } from "react";

const INITIAL_STATE = {
  isOpen: false,
  mode: "list",
  tokenId: null,
  defaultPrice: "",
  name: "",
};

export function usePriceModal(
  myNFTs,
  { listToken, updateListing, setLoading, kList, kUpdate }
) {
  const [modalState, setModalState] = useState(INITIAL_STATE);

  const openList = useCallback(
    (tokenId, name) => {
      const fallbackName =
        myNFTs.find((n) => n.tokenId === String(tokenId))?.name || "";
      setModalState({
        isOpen: true,
        mode: "list",
        tokenId,
        defaultPrice: "0.01",
        name: name ?? fallbackName,
      });
    },
    [myNFTs]
  );

  const openUpdate = useCallback(
    (tokenId, currentPrice, name) => {
      const fallbackName =
        myNFTs.find((n) => n.tokenId === String(tokenId))?.name || "";
      setModalState({
        isOpen: true,
        mode: "update",
        tokenId,
        defaultPrice: String(currentPrice ?? "0.01"),
        name: name ?? fallbackName,
      });
    },
    [myNFTs]
  );

  const close = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const confirm = useCallback(
    async (priceStr) => {
      if (!priceStr || Number(priceStr) <= 0) {
        alert("Introduce un precio > 0");
        return;
      }

      const { mode, tokenId } = modalState;
      if (tokenId === null || tokenId === undefined) {
        alert("Selecciona un NFT válido");
        return;
      }

      const key = mode === "list" ? kList(tokenId) : kUpdate(tokenId);
      setLoading(key, true);

      try {
        if (mode === "list") {
          const my = myNFTs.find((n) => n.tokenId === tokenId);
          if (my?.listed) {
            alert("Este NFT ya está listado");
            return;
          }
          await listToken(tokenId, priceStr);
        } else {
          await updateListing(tokenId, priceStr);
        }
        close();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Error al confirmar precio");
      } finally {
        setLoading(key, false);
      }
    },
    [
      close,
      kList,
      kUpdate,
      listToken,
      modalState,
      myNFTs,
      setLoading,
      updateListing,
    ]
  );

  return {
    modalState,
    openList,
    openUpdate,
    close,
    confirm,
  };
}
