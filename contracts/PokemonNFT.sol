// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PokemonNFT
 * @dev ERC721 contract for Pokemon card NFTs with comprehensive metadata
 */
contract PokemonNFT is ERC721, ERC721URIStorage, Ownable, Pausable {
    uint256 private _nextTokenId;

    /// @dev Pokemon card attributes stored on-chain
    struct PokemonCard {
        string name;
        string pokemonType;      // e.g., "Fire", "Water", "Electric"
        uint8 hp;                // Hit points
        uint8 attack;
        uint8 defense;
        uint8 rarity;            // 1-5 (common to legendary)
    }

    mapping(uint256 => PokemonCard) public pokemonCards;

    event PokemonMinted(
        address indexed to,
        uint256 indexed tokenId,
        string name,
        string pokemonType,
        uint8 rarity
    );

    constructor() ERC721("PokemonCard", "PKMN") Ownable(msg.sender) {}

    /**
     * @dev Mints a new Pokemon card with metadata
     * @param to Recipient address
     * @param uri Token URI for off-chain metadata
     * @param name Pokemon name
     * @param pokemonType Type (Fire, Water, etc.)
     * @param hp Hit points
     * @param attack Attack stat
     * @param defense Defense stat
     * @param rarity Rarity 1-5
     */
    function mint(
        address to,
        string calldata uri,
        string calldata name,
        string calldata pokemonType,
        uint8 hp,
        uint8 attack,
        uint8 defense,
        uint8 rarity
    ) external onlyOwner whenNotPaused {
        require(bytes(name).length > 0, "Name required");
        require(rarity >= 1 && rarity <= 5, "Rarity must be 1-5");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        pokemonCards[tokenId] = PokemonCard({
            name: name,
            pokemonType: pokemonType,
            hp: hp,
            attack: attack,
            defense: defense,
            rarity: rarity
        });

        emit PokemonMinted(to, tokenId, name, pokemonType, rarity);
    }

    /// @dev Returns full card data for a token
    function getCard(uint256 tokenId) external view returns (PokemonCard memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return pokemonCards[tokenId];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
