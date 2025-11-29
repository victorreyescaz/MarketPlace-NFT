# 🧬 NFT Marketplace – Full-Stack dApp

dApp full-stack para **mintear, listar y comprar NFTs** en la testnet de Sepolia.  
El objetivo del proyecto es demostrar **skills de Solidity + Hardhat + Frontend Web3** en un caso de uso real.

Aquí te dejo una demo en producción (Vercel) para poder interactuar con el Marketplace sin instalar nada

[Marketplace]()

---

## ✨ Funcionalidades principales

- 🪙 **Mint y listado de NFTs** desde el propio Marketplace. Posibilidad de únicamente mintear, listar o ambas a la vez.
- 💰 **Modificar precio y cancelar listado** de tus NFTs en venta.
- 📃 **Lista de NFTs** en venta con precio en ETH y conversión en tiempo real a dolares($).
- 🛒 **Compra de NFTs** directamente desde la UI.
- 🎚 **Filtros** (por nombre, descripción, tokenId y seller).
- 🫰 **Retiro de ganancias** para vendedores (withdraw).
- 🔐 Verificación básica de seguridad: CEI, reentrancy guard, validaciones de inputs.

---

## 🧱 Arquitectura del proyecto

```
Marketplace/          # paquete raíz
  backend/            # Contratos, endpoints, scripts de deploy
  frontend/           # App web (Vite/React + Web3)
```

---

## 👉 Stack principal

- **Smart contracts** Solidity, Hardhat, OpenZeppelin.
- **Backend tooling** Node.js, scripts de deploy.
- **Frontend** React/Ethers.js, Chakra, Appkit
- **Blockchain** ETH Sepolia

---

## 🧾 Smart Contracts (backend)

- Marketplace.sol

  ·Crear órdenes de venta, update precio, compra y cancelación. <br>
  ·Función de withdraw para retirar ganancias.
  <br>

- NFT.sol

  · ERC-721 (NFT) con funciones de mint. <br>
  · Control de permisos de minteo (solo owner/marketplace).

➡️ Más detalles técnicos en [backend Readme](Marketplace/backend/README.md)

---

## 🖥️ Frontend (dApp)

Conexión de wallet (ej. MetaMask).

Vistas:

- Panel de usuario:

  · Formulario mint NFT con posibilidad de listarlo (conversión ETH <-> $ tiempo real)

  · Sección MisNFTs donde consulta NFTs usuario y da opciones de listar, cambiar precio y cancelar listado según estado del NFT.

  · Actualizar proceeds y retirada a wallet.

  · Marketplace Global con listado de NFTs en venta con filtros.

- Posibilidad de navegar por el Marketplace y ver NFTs listados sin conectar wallet.

➡️ Más detalles técnicos en [frontend Readme](Marketplace/frontend/README.md)

---

## 🚀 Cómo arrancar rápido (en local)

1. Clonar el repositorio

```bash
    git clone https://github.com/victorreyescaz/MarketPlace-NFT.git
    cd MarketPlace-NFT
```

2. Backend

```bash
   cd Marketplace/backend
   nvm use
   npm install
```

- Copiar plantilla env.example a .env
- Introducir las variables de entorno necesarias

```bash
   npm run dev
```

➡️ Más detalles técnicos en [backend Readme](Marketplace/backend/README.md)

3. Frontend

```bash
   cd Marketplace/frontend
   nvm use
   npm install
   npm run dev
```

- Abre tu navegador en http://localhost:5173

---

## 🔒 Diseño de seguridad

- Uso del patrón Checks-Effects-Interactions (CEI).
- Protección ante reentrancy en funciones sensibles (compra, withdraw).

- Validaciones de:

  · Precios (no 0).

  · Propietario del NFT antes de listar.

  · Existencia del listing antes de comprar/cancelar.

  · Control conexion con Sepolia.

- Uso de eventos para compras, listados y retiros.

---

## 🗺️ Roadmap / Mejoras futuras

- Implementar función burn para poder quemar tokens.

- Soporte para múltiples colecciones de NFTs.

- Implementar función approve para dar permisos a un tercero.

- Sistema de royalties para creadores.

- Histórico de actividad

- Optimización de RPC.

---

## 👤 Autor

Nombre: Víctor Reyes

Rol: Desarrollador Blockchain / Full Stack Web3

[Linkedin](https://www.linkedin.com/in/v%C3%ADctor-reyes-cazorla-75361b10b/)

Email: victorreyes.caz@gmail.com
