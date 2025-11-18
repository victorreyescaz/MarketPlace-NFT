/**
Encapsula la lógica de mintear NFTs: valida inputs, sube archivos/metadatos a IPFS, llama al contrato y opcionalmente lista el NFT.

El hook retorna { handleMint } para que MintSection lo use al hacer clic en “Mint NFT”. De esta forma, toda la lógica de minting/listing queda fuera del componente de UI
 */

import { useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { uploadFileToPinata, uploadJSONToPinata } from "../services/pinata";
import { NFT_ADDRESS, NFT_IFACE } from "../utils/contract";
import { ensureSupportedChain } from "./useRequiredChanges";

export function useMinting({
  walletProvider,
  isConnected,
  open,
  showError,
  showInfo,
  file,
  name,
  desc,
  autoList,
  priceEth,
  listToken,
  loadMyNFTs,
  setName,
  setDesc,
  setFile,
  setBusy,
  setPriceEth,
}) {
  const handleMint = useCallback(async () => {
    if (!isConnected) {
      return open({ view: "Connect", namespace: "eip155" });
    }

    if (!(await ensureSupportedChain(walletProvider))) {
      return showError?.("Cambia a Sepolia para mintear en NFT");
    }

    if (!walletProvider) return showError?.("No hay wallet provider");

    if (!file || !name) return showError?.("Falta imagen y/o nombre");

    if (autoList && (!priceEth || Number(priceEth) <= 0)) {
      return showError?.("Necesitas un precio para listar automáticamente");
    }

    let autoListFailed = false;

    try {
      setBusy(true);
      showInfo?.("Subiendo a IPFS...");
      const imageURI = await uploadFileToPinata(file);

      showInfo?.("Creando metadata...");
      const tokenURI = await uploadJSONToPinata({
        name,
        description: desc || "",
        image: imageURI,
      });

      showInfo?.("Firmando transacción de mint...");
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const contract = new Contract(NFT_ADDRESS, NFT_IFACE, signer);

      const tx = await contract.mint(tokenURI);
      const receipt = await tx.wait();
      const transferEvent = receipt.logs
        .map((log) => contract.interface.parseLog(log))
        .find((parsed) => parsed?.name === "Transfer");
      const tokenId = transferEvent?.args?.tokenId?.toString();

      if (autoList) {
        try {
          showInfo?.("Preparando listado...");
          await listToken(tokenId, priceEth);
          showInfo?.("✅ NFT minteado y listado con éxito");
        } catch (err) {
          autoListFailed = true;
          throw err;
        }
      }
      if (!autoList) {
        showInfo?.("✅ NFT minteado con éxito");
        await loadMyNFTs?.();
      }

      setName("");
      setDesc("");
      setPriceEth("");
      setFile(null);
    } catch (err) {
      if (autoListFailed) {
        showError?.(
          err,
          "El NFT se minteó pero el listado falló, puedes intentarlo desde Mis NFTs"
        );
      } else {
        showError?.("No se pudo mintear el NFT");
      }
    } finally {
      setBusy(false);
    }
  }, [
    desc,
    file,
    isConnected,
    name,
    open,
    setBusy,
    setDesc,
    setFile,
    loadMyNFTs,
    setName,
    showError,
    showInfo,
    walletProvider,
    autoList,
    listToken,
    priceEth,
    setPriceEth,
  ]);

  return { handleMint };
}
