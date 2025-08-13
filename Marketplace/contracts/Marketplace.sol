// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price; // en wei
    }

    // nftAddress => tokenId => Listing
    mapping(address => mapping(uint256 => Listing)) private _listings;

    // vendedor => saldo a retirar (en wei)
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
    modifier isOwner(
        address nft,
        uint256 tokenId,
        address spender
    ) {
        if (IERC721(nft).ownerOf(tokenId) != spender) revert NotOwner();
        _;
    }

    modifier isListed(address nft, uint256 tokenId) {
        if (_listings[nft][tokenId].price == 0) revert NotListed();
        _;
    }

    modifier notListed(address nft, uint256 tokenId) {
        if (_listings[nft][tokenId].price > 0) revert AlreadyListed();
        _;
    }

    // Core

    function listItem(
        address nft,
        uint256 tokenId,
        uint256 price
    ) external isOwner(nft, tokenId, msg.sender) notListed(nft, tokenId) {
        if (price == 0) revert PriceMustBeAboveZero();

        // marketplace debe estar aprobado
        IERC721 erc = IERC721(nft);
        if (
            erc.getApproved(tokenId) != address(this) &&
            !erc.isApprovedForAll(msg.sender, address(this))
        ) {
            revert NotApprovedForMarketplace();
        }

        _listings[nft][tokenId] = Listing({seller: msg.sender, price: price});
        emit ItemListed(nft, tokenId, msg.sender, price);
    }

    function cancelListing(
        address nft,
        uint256 tokenId
    ) external isOwner(nft, tokenId, msg.sender) isListed(nft, tokenId) {
        delete _listings[nft][tokenId];
        emit ItemCanceled(nft, tokenId, msg.sender);
    }

    function updateListing(
        address nft,
        uint256 tokenId,
        uint256 newPrice
    ) external isOwner(nft, tokenId, msg.sender) isListed(nft, tokenId) {
        if (newPrice == 0) revert PriceMustBeAboveZero();
        _listings[nft][tokenId].price = newPrice;
        emit ItemUpdated(nft, tokenId, msg.sender, newPrice);
    }

    function buyItem(
        address nft,
        uint256 tokenId
    ) external payable nonReentrant isListed(nft, tokenId) {
        Listing memory listing = _listings[nft][tokenId];
        if (msg.value < listing.price) revert PriceNotMet();

        // acumula fondos del vendedor
        _proceeds[listing.seller] += msg.value;

        // borra listing antes de transferir (Checks-Effects-Interactions)
        delete _listings[nft][tokenId];

        // transfiere NFT al comprador
        IERC721(nft).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemBought(nft, tokenId, msg.sender, listing.price);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 amount = _proceeds[msg.sender];
        if (amount == 0) revert NoProceeds();
        _proceeds[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    // Views
    function getListing(
        address nft,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return _listings[nft][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return _proceeds[seller];
    }
}
