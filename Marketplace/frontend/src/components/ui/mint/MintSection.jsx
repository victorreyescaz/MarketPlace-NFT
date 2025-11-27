/**
Contenedor que coordina el estado del formulario de minteo y delega la lógica a `useMinting`, pasando todo a `MintForm`.

Declara y mantiene todo el estado necesario y prepara los handlers (useState's)

Inicializa el hook useMinting
 */

import React from "react";
import MintForm from "./MintForm";
import { useMinting } from "../../../hooks/useMinting";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);

const ALLOWED_IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg",
]);

export function MintSection({
  walletProvider,
  isConnected,
  open,
  showError,
  showInfo,
  listToken,
  loadMyNFTs,
  onClose,
}) {

  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [autoList, setAutoList] = React.useState(false);
  const [priceEth, setPriceEth] = React.useState("");

  const onPickFile = (selectedFile, inputEl) => {
    if (!selectedFile) return setFile(null);

    const typeOk =
      selectedFile.type?.startsWith("image/") ||
      ALLOWED_IMAGE_TYPES.has(selectedFile.type);
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    const extOk = ext ? ALLOWED_IMAGE_EXTS.has(ext) : false;

    if (!typeOk && !extOk) {
      showError?.(
        "Solo se permiten archivos de imagen (JPG, PNG, GIF, WebP, SVG, AVIF)."
      );
      if (inputEl) inputEl.value = "";
      return setFile(null);
    }

    setFile(selectedFile);
  };

  const { handleMint } = useMinting({
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
    setAutoList,
    setPriceEth,
  });

  return (
    <MintForm
      name={name}
      desc={desc}
      onNameChange={setName}
      onDescChange={setDesc}
      onFileChange={onPickFile}
      onMint={handleMint}
      onClose={onClose}
      busy={busy}
      isConnected={isConnected}
      file={file}
      autoList={autoList}
      onToggleList={setAutoList}
      priceEth={priceEth}
      onPriceChange={setPriceEth}
    />
  );
}
