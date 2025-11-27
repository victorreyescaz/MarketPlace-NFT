/**
Administra el estado del modal de precio para listar/actualizar y expone handlers para abrirlo, cerrarlo y confirmar la acción.

Se usa en App.jsx para enlazarlo con PriceModal y con las acciones de MyNFTSection. De este modo, toda la lógica del modal queda centralizada en el hook.
 */

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
    async (priceInput) => {
      const rawPrice =
        priceInput && typeof priceInput === "object"
          ? priceInput.eth ?? priceInput.price ?? priceInput.value
          : priceInput;

      const normalizedPrice = String(rawPrice ?? "")
        .replace(",", ".")
        .trim();
      const numericPrice = Number(normalizedPrice);

      if (!normalizedPrice || Number.isNaN(numericPrice) || numericPrice <= 0) {
        alert("Introduce un precio válido > 0");
        return;
      }

      const { mode, tokenId } = modalState;
      if (tokenId === null || tokenId === undefined) {
        alert("Selecciona un NFT válido");
        return;
      }

      const currentPrice = String(modalState.defaultPrice ?? "")
        .replace(",", ".")
        .trim();
      const currentPriceNumber = Number(currentPrice);
      if (
        mode === "update" &&
        currentPrice &&
        !Number.isNaN(currentPriceNumber) &&
        numericPrice === currentPriceNumber
      ) {
        alert("Introduce un precio diferente al actual");
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
          await listToken(tokenId, normalizedPrice);
        } else {
          await updateListing(tokenId, normalizedPrice);
        }
        close();
      } catch (e) {
        console.error(e);
        alert("Error al confirmar precio");
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
