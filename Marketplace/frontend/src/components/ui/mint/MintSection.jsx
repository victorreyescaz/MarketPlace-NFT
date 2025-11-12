import React from "react";
import MintForm from "./MintForm";
import { useMinting } from "../../../hooks/useMinting";

export function MintSection({
  walletProvider,
  isConnected,
  open,
  showError,
  showInfo,
}) {
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

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
    setName,
    setDesc,
    setFile,
    setBusy,
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
    />
  );
}
