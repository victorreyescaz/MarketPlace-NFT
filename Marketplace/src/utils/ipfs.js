import { NFTStorage, File } from "nft.storage";

export async function uploadToIPFS(file, { name, description }) {
  const raw = import.meta.env.VITE_PINATA_JWT;
  if (!raw) throw new Error("VITE_PINATA_JWT no definida");
  const token = raw.trim();
  if (!token.startsWith("eyJ")) {
    throw new Error("API Key con formato inválido (¿copiada incompleta?)");
  }

  const client = new NFTStorage({ token });
  const imageFile = new File([file], file.name, { type: file.type });

  // Si la key es inválida, aquí lanzará 401
  const metadata = await client.store({
    name,
    description,
    image: imageFile,
  });

  return metadata.url; // ipfs://<cid>/metadata.json
}
