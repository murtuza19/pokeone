const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonNFT", function () {
  let pokemonNFT;
  let owner;
  let user1;

  // Deploy a fresh PokemonNFT contract before each test so every test
  // starts with a clean state (no minted tokens, default owner).
  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    pokemonNFT = await PokemonNFT.deploy();
  });

  describe("Deployment", function () {
    // Verify that the deployer account is recorded as the contract owner,
    // which is important because only the owner can mint new cards.
    it("Should set the right owner", async function () {
      expect(await pokemonNFT.owner()).to.equal(owner.address);
    });

    // Confirm the ERC-721 collection metadata is initialised correctly
    // (name = "PokemonCard", symbol = "PKMN").
    it("Should have correct name and symbol", async function () {
      expect(await pokemonNFT.name()).to.equal("PokemonCard");
      expect(await pokemonNFT.symbol()).to.equal("PKMN");
    });
  });

  describe("Minting", function () {
    // Mint a Pikachu card to user1 and verify:
    //   - user1 owns the new token (id 0)
    //   - the token URI points to the correct IPFS hash
    //   - all on-chain card metadata (name, type, hp, attack, defense, rarity)
    //     matches what was passed to mint()
    it("Should mint a Pokemon card with metadata", async function () {
      await pokemonNFT.mint(
        user1.address,
        "ipfs://QmTest123",
        "Pikachu",
        "Electric",
        35,
        55,
        40,
        3
      );

      expect(await pokemonNFT.ownerOf(0)).to.equal(user1.address);
      expect(await pokemonNFT.tokenURI(0)).to.equal("ipfs://QmTest123");

      const card = await pokemonNFT.getCard(0);
      expect(card.name).to.equal("Pikachu");
      expect(card.pokemonType).to.equal("Electric");
      expect(card.hp).to.equal(35);
      expect(card.attack).to.equal(55);
      expect(card.defense).to.equal(40);
      expect(card.rarity).to.equal(3);
    });

    // Ensure a PokemonMinted event is emitted with the correct arguments
    // (recipient, tokenId, name, type, rarity) so off-chain services can
    // track new mints.
    it("Should emit PokemonMinted event", async function () {
      await expect(
        pokemonNFT.mint(user1.address, "uri", "Charizard", "Fire", 78, 84, 78, 5)
      )
        .to.emit(pokemonNFT, "PokemonMinted")
        .withArgs(user1.address, 0, "Charizard", "Fire", 5);
    });

    // Only the contract owner should be able to mint. When a non-owner
    // (user1) attempts to mint, the transaction must revert with the
    // OwnableUnauthorizedAccount error from OpenZeppelin's Ownable.
    it("Should reject mint from non-owner", async function () {
      await expect(
        pokemonNFT.connect(user1).mint(
          user1.address,
          "uri",
          "Pikachu",
          "Electric",
          35,
          55,
          40,
          3
        )
      ).to.be.revertedWithCustomError(pokemonNFT, "OwnableUnauthorizedAccount");
    });

    // Rarity must be between 1 and 5 (inclusive). Verify that both
    // out-of-range values (0 and 6) are rejected.
    it("Should reject invalid rarity", async function () {
      await expect(
        pokemonNFT.mint(user1.address, "uri", "Pikachu", "Electric", 35, 55, 40, 0)
      ).to.be.revertedWith("Rarity must be 1-5");

      await expect(
        pokemonNFT.mint(user1.address, "uri", "Pikachu", "Electric", 35, 55, 40, 6)
      ).to.be.revertedWith("Rarity must be 1-5");
    });

    // An empty Pokemon name is not allowed; the contract should revert
    // with "Name required" to enforce basic data integrity.
    it("Should reject empty name", async function () {
      await expect(
        pokemonNFT.mint(user1.address, "uri", "", "Electric", 35, 55, 40, 3)
      ).to.be.revertedWith("Name required");
    });
  });

  describe("Pausable", function () {
    // Test the emergency pause mechanism:
    //   1. After calling pause(), minting should revert with EnforcedPause.
    //   2. After calling unpause(), minting should succeed again, proving
    //      the contract can be safely toggled on and off.
    it("Should pause and unpause", async function () {
      await pokemonNFT.pause();
      await expect(
        pokemonNFT.mint(user1.address, "uri", "Pikachu", "Electric", 35, 55, 40, 3)
      ).to.be.revertedWithCustomError(pokemonNFT, "EnforcedPause");

      await pokemonNFT.unpause();
      await pokemonNFT.mint(user1.address, "uri", "Pikachu", "Electric", 35, 55, 40, 3);
      expect(await pokemonNFT.ownerOf(0)).to.equal(user1.address);
    });
  });
});
