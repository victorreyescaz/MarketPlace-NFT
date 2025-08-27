/*
  Util para subir archivos e info de metadata a IPFS mediante nft.storage. Puente entre frontend y almacenamiento descentralizado de los NFTs

    - Recibe un archivo (imagen) y datos de metadata (name, description)
    - Sube ambos a IPFS
    - Devuelve la URL que será usada como Token URI en el contrato NFT


  Requiere un token JWT
*/

// NFTStorage: cliente para subir ficheros/metadata a IPFS;
// File: estándar web que representa un archivo con nombre y tipo. Para que no haya errores a la hora de reconocer la imagen ya sea por navegador, node.js. Asegura que cuando nft.storage suba la imagen sepa que tipo de archivo es y cree el metadata correcto, tambien quien consuma esa metadata podrá renderizar bien la imagen
import { NFTStorage, File } from "nft.storage";

export async function uploadToIPFS(file, { name, description }) {
  const raw = import.meta.env.VITE_PINATA_JWT;
  if (!raw) throw new Error("VITE_PINATA_JWT no definida");

  const token = raw.trim();
  if (!token.startsWith("eyJ")) {
    throw new Error("API Key con formato inválido (¿copiada incompleta?)");
  }

  const client = new NFTStorage({ token });

  //
  const imageFile = new File([file], file.name, { type: file.type });

  // Sube la imagen y el JSON a IPFS bajo un CID. Si la key es inválida, aquí lanzará 401
  const metadata = await client.store({
    name,
    description,
    image: imageFile,
  });

  // Devuelve URI del metadata, que es lo que pasamos al contrato NFT.mint
  return metadata.url; // ipfs://<cid>/metadata.json
}
