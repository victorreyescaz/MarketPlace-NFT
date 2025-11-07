import { useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { uploadFileToPinata, uploadJSONToPinata } from "../services/pinata";
import { NFT_ADDRESS, NFT_IFACE } from "../utils/contract";

export function useMinting({
  walletProvider,
  isConnected,
  open,
  showError,
  showInfo,
  file,
  name,
  desc,
  setName,
  setDesc,
  setFile,
  setBusy,
}) {
  const handleMint = useCallback(async () => {
    if (!isConnected) {
      return open({ view: "Connect", namespace: "eip155" });
    }
    if (!walletProvider) return showError?.("No hay wallet provider");
    if (!file || !name) return showError?.("Falta imagen y/o nombre");

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
      await tx.wait();

      showInfo?.("✅ NFT minteado con éxito");
      setName("");
      setDesc("");
      setFile(null);
    } catch (e) {
      showError?.(e, "No se pudo mintear el NFT");
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
    setName,
    showError,
    showInfo,
    walletProvider,
  ]);

  return { handleMint };
}
