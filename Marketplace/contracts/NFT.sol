// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol"; // Guarda URIs por token en storage
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol"; // Indexa y permite enumerar todos los tokens y los de cada dueño
import "@openzeppelin/contracts/access/Ownable.sol"; // onlyOwner

contract NFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    uint256 public tokenCount; // Contador de tokens

    constructor(
        address initialOwner
    ) ERC721("NFT Marketplace", "NFTM") Ownable(initialOwner) {}

    // Funcion para mintear NFTs
    function mint(string memory _tokenURI) external returns (uint256) {
        tokenCount++;
        _safeMint(msg.sender, tokenCount);
        _setTokenURI(tokenCount, _tokenURI);
        return tokenCount;
    }

    // ----------------- Overrides OZ v5 -------------- --- Hay que implementar estos overrides ya que de los contratos que heredamos tenemos herencia múltiple ---

    // Hook de ERC721Enumerable,
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    // Hook para separar el incremento de balances de flujo de _update
    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    // tokenURI viene de URIStorage, combina con ERC721
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    // Importante: incluir también ERC721URIStorage aquí
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    //     function _burn(uint256 tokenId)
    //     internal
    //     override(ERC721, ERC721URIStorage)
    //     {
    //     super._burn(tokenId); // limpia también el tokenURI en storage
    //     }
}
