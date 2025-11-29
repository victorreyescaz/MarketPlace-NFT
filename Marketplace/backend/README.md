# README de `/backend`

Guía para operar tu propia instancia del marketplace: desplegar contratos, configurar `.env` y levantar la API.

---

## 🔧 Stack

- **Solidity:** 0.8.x
- **Framework:** Hardhat
- **Librerías:** OpenZeppelin (ERC721, Ownable, ReentrancyGuard, etc.)
- **Node.js:** v18+ recomendado

---

## 📂 Estructura

```txt
backend/
  contracts/
    Marketplace.sol
    NFT.sol
  routes/
    marketplace.js
    pinata.js
  scripts/
    deploy.js
    deployMarketplace.js
  hardhat.config.cjs
  server.js
  .env
  .nvmrc
```

---

## ✅ Prerrequisitos

- Node v18+ (usa `nvm use`).
- Wallet con ETH en Sepolia y RPC válido (puedes pegar el de Metamask).
- Cuenta de Pinata con JWT para pinning.
- (Opcional) Project ID de AppKit si expones `/api/config/appkit`.

---

## 🔐 Variables de entorno (`.env`)

Copia `.env.example` y completa:

- `RPC_SEPOLIA`: URL RPC de Sepolia.
- `PRIVATE_KEY`: clave privada que firma el deploy.
- `PINATA_JWT`: JWT de Pinata (requerido para arrancar el servidor).
- `APPKIT_PROJECT_ID`: opcional, usado por `/api/config/appkit`.
- `PORT`: opcional, por defecto 4000.
- Tras desplegar, rellena `NFT_ADDRESS`, `MARKET_ADDRESS` y `MARKET_DEPLOY_BLOCK` para que `/api/marketplace/listings` funcione.

Ejemplo:

```bash
RPC_SEPOLIA=https://sepolia.infura.io/v3/xxx
PRIVATE_KEY=0xabc123...
PINATA_JWT=eyJhbGciOi...
APPKIT_PROJECT_ID=your_project_id
PORT=4000

# Completar después del deploy
NFT_ADDRESS=0x...
MARKET_ADDRESS=0x...
MARKET_DEPLOY_BLOCK=0
```

Opcionales de ajuste de escaneo/gateway (tienen valores por defecto): `IPFS_GATEWAY`, `BLOCK_PAGE`, `PAGE_DELAY_MS`, `MARKETPLACE_MAX_LIMIT`, `MARKETPLACE_MAX_PAGES`, `MARKETPLACE_SCAN_MAX`, `GLOBAL_BATCH_TARGET`, `GLOBAL_MAX_PAGES`.

---

## 🏗️ Deploy de contratos (Sepolia)

```bash
cd backend
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/deployMarketplace.js --network sepolia
```

Anota las direcciones de salida y el número de bloque de despliegue (del tx hash) y pégalos en `.env`. Si quieres otra red, edita `hardhat.config.cjs` con su `url` y `accounts`.

---

## 🚀 Levantar el backend

```bash
cd backend
nvm use
npm install
npm run dev
```

---

## 🛠️ Notas

- Sin `PINATA_JWT` el servidor se cierra al arrancar.
- `/api/marketplace/listings` necesita `RPC_SEPOLIA`, `MARKET_ADDRESS`, `NFT_ADDRESS` y `MARKET_DEPLOY_BLOCK`; también puede leer los prefijos `VITE_` si compartes env con el frontend.
- Si tu RPC aplica rate limit, ajusta `BLOCK_PAGE` o `PAGE_DELAY_MS` para reducir llamadas.
