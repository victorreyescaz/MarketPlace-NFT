// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // Proteccion para ataques de reentrada, lo utilizamos en funciones criticas como comprar/retirar

contract Marketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price; // en wei
    }

    // nftAddress (address contrato ERC-721) => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) private _listings;

    // vendedor => saldo a retirar (en wei). Contabilidad de fondos acumulados por el vendedor
    mapping(address => uint256) private _proceeds;

    // Errors
    error NotOwner();
    error NotListed();
    error AlreadyListed();
    error PriceMustBeAboveZero();
    error NotApprovedForMarketplace();
    error PriceNotMet();
    error NoProceeds();

    // Events
    event ItemListed(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    event ItemCanceled(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller
    );
    event ItemBought(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );
    event ItemUpdated(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 newPrice
    );
    event ProceedsWithdrawn(address indexed seller, uint256 amount);

    // Modifiers

    // Onlyowner
    modifier isOwner(
        address nft,
        uint256 tokenId,
        address spender // Propietario o approved(wallet con permisos para transferir el token) en el caso de que lo haya
    ) {
        if (IERC721(nft).ownerOf(tokenId) != spender) revert NotOwner();
        _;
    }

    // Comprobar NFT listado
    modifier isListed(address nft, uint256 tokenId) {
        if (_listings[nft][tokenId].price == 0) revert NotListed();
        _;
    }

    // Comprobar si el NFT no esta listado
    modifier notListed(address nft, uint256 tokenId) {
        if (_listings[nft][tokenId].price > 0) revert AlreadyListed();
        _;
    }

    // =======================================================================================================

    // Core

    // Funcion para listar un NFT
    function listItem(
        address nft,
        uint256 tokenId,
        uint256 price
    ) external isOwner(nft, tokenId, msg.sender) notListed(nft, tokenId) {
        if (price == 0) revert PriceMustBeAboveZero();

        // marketplace debe estar aprobado
        IERC721 erc = IERC721(nft); // Casteamos/guardamos la direccion nft a la interfaz ERC721 para poder llamar a sus métodos

        // Comprobacion que el marketplace pueda transferir el NFT cuando se compre
        if (
            erc.getApproved(tokenId) != address(this) &&
            !erc.isApprovedForAll(msg.sender, address(this))
        ) {
            revert NotApprovedForMarketplace();
        }

        // Si pasa el if creamos/actualizamos la entrada del mapping _listings y emitimos evento
        _listings[nft][tokenId] = Listing({seller: msg.sender, price: price});
        emit ItemListed(nft, tokenId, msg.sender, price);
    }

    // Funcion para cancelar el listado de un NFT
    function cancelListing(
        address nft,
        uint256 tokenId
    ) external isOwner(nft, tokenId, msg.sender) isListed(nft, tokenId) {
        delete _listings[nft][tokenId];
        emit ItemCanceled(nft, tokenId, msg.sender);
    }

    // Funcion para actualizar el precio de un NFT
    function updateListing(
        address nft,
        uint256 tokenId,
        uint256 newPrice
    ) external isOwner(nft, tokenId, msg.sender) isListed(nft, tokenId) {
        if (newPrice == 0) revert PriceMustBeAboveZero();
        _listings[nft][tokenId].price = newPrice;
        emit ItemUpdated(nft, tokenId, msg.sender, newPrice);
    }

    // Funcion para comprar un NFT
    function buyItem(
        address nft,
        uint256 tokenId
    ) external payable nonReentrant isListed(nft, tokenId) {
        Listing memory listing = _listings[nft][tokenId]; // Copiamos el struct en memoria temporal para utilizarlo en esta funcion. Copia inmutable. Lo que hagamos en esta funcion no cambiara lo guardado en _listings

        if (msg.value < listing.price) revert PriceNotMet(); // Cambiar a if (msg.value != listing.price) revert PriceNotMet() para evitar enviar mas valor del que vale el token

        // Acumula fondos del vendedor
        _proceeds[listing.seller] += msg.value;

        // Borra listing antes de transferir
        delete _listings[nft][tokenId];

        // Transfiere NFT al comprador
        IERC721(nft).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemBought(nft, tokenId, msg.sender, listing.price);
    }

    // Funcion para que el vendedor retire sus ganancias acumuladas
    function withdrawProceeds() external nonReentrant {
        uint256 amount = _proceeds[msg.sender];

        if (amount == 0) revert NoProceeds();

        // Si pasa el if es que hay amount, reseteamos el saldo a 0 antes de enviarlo. Patron Checks=>Effects=>Interactions. Validamos que hay saldo, actualizamos estado interno y transferimos ETH. De esta manera aunque el envio falle/reentre no se puede volver a retirar la misma cantidad.
        _proceeds[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}(""); // Enviamos los fondos
        require(ok, "Transfer failed"); // Requerimos que ok sea true, sino revertimos
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    // Funciones de lectura

    // Funcion para consultar la informacion de un NFT listado, si no esta listado devuelve valores por defecto price:0 seller:0x00000...
    function getListing(
        address nft,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return _listings[nft][tokenId];
    }

    // Funcion para consultar el saldo acumulado de un vendedor
    function getProceeds(address seller) external view returns (uint256) {
        return _proceeds[seller];
    }
}
