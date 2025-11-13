import React from "react";
import MintForm from "./MintForm";
import { useMinting } from "../../../hooks/useMinting";

export function MintSection({
  walletProvider,
  isConnected,
  open,
  showError,
  showInfo,
  listToken,

}) {

  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [autoList, setAutoList] = React.useState(false);
  const [priceEth, setPriceEth] = React.useState("");

  const onPickFile = (selectedFile) => setFile(selectedFile || null);

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
