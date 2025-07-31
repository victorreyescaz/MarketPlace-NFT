// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol"; // Version del ERC721 que permite guardar y recuperar tokenURI individual por cada NFT
import "@openzeppelin/contracts/utils/Counters.sol"; // Para autoincrementar IDs de los NFTs

contract NFTMarketplace is ERC721URIStorage {
    using Counters for Counters.Counter; // Libreria sobre _tokenIds, permite usar .increment(), .current()
    Counters.Counter private _tokenIds;

    struct MarketItem {
        uint256 tokenId;
        address payable owner;
        uint256 price;
        bool isListed;
    }

    mapping(uint256 => MarketItem) public items;

    address payable public marketplaceOwner; // Cobra las tarifas por cada minteo
    uint256 public listingFee = 0.01 ether; // El usuario paga 0.01 ether por crear el NFT

    constructor() ERC721("NFTMarketplace", "NFTM") {
        marketplaceOwner = payable(msg.sender);
    }

    // Funcion para mintear un NFT en el marketplace
    function mintNFT(
        string memory tokenURI,
        uint256 price
    ) public payable returns (uint256) {
        require(msg.value == listingFee, "Debe pagar la tarifa de listado");
        require(price > 0, "Precio debe ser mayor que 0");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current(); // Obtiene el nuevo ID del nft incrementado con .increment()

        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, tokenURI);

        items[newItemId] = MarketItem( // Creamos una entrada del NFT en el marketplace. Marca como listado
            newItemId,
            payable(msg.sender),
            price,
            true
        );

        return newItemId;
    }

    // Funcion para comprar un NFT
    function buyNFT(uint256 tokenId) public payable {
        MarketItem storage item = items[tokenId];
        require(item.isListed, "NFT no esta en venta");
        require(msg.value == item.price, "Monto incorrecto");

        address payable seller = item.owner;

        item.owner = payable(msg.sender);
        item.isListed = false;

        _transfer(seller, msg.sender, tokenId);

        seller.transfer(msg.value); // Enviamos el pago al vendedor mas la comision
        marketplaceOwner.transfer(listingFee);
    }

    // Funcion que devuelve el listado de NFTs actual
    function getAllListedItems() public view returns (MarketItem[] memory) {
        // Contamos los NFTs
        uint256 total = _tokenIds.current();
        uint256 count = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (items[i].isListed) count++;
        }

        // Creamos un array con el struct MarketItem
        MarketItem[] memory result = new MarketItem[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (items[i].isListed) {
                result[index] = items[i];
                index++;
            }
        }

        return result;
    }
}
