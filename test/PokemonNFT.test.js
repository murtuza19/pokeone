const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonNFT", function () {
  let pokemonNFT;
  let owner;
  let user1;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    pokemonNFT = await PokemonNFT.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await pokemonNFT.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await pokemonNFT.name()).to.equal("PokemonCard");
      expect(await pokemonNFT.symbol()).to.equal("PKMN");
    });
  });

  describe("Minting", function () {
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

    it("Should emit PokemonMinted event", async function () {
      await expect(
        pokemonNFT.mint(user1.address, "uri", "Charizard", "Fire", 78, 84, 78, 5)
      )
        .to.emit(pokemonNFT, "PokemonMinted")
        .withArgs(user1.address, 0, "Charizard", "Fire", 5);
    });

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

    it("Should reject invalid rarity", async function () {
      await expect(
        pokemonNFT.mint(user1.address, "uri", "Pikachu", "Electric", 35, 55, 40, 0)
      ).to.be.revertedWith("Rarity must be 1-5");

      await expect(
        pokemonNFT.mint(user1.address, "uri", "Pikachu", "Electric", 35, 55, 40, 6)
      ).to.be.revertedWith("Rarity must be 1-5");
    });

    it("Should reject empty name", async function () {
      await expect(
        pokemonNFT.mint(user1.address, "uri", "", "Electric", 35, 55, 40, 3)
      ).to.be.revertedWith("Name required");
    });
  });

  describe("Pausable", function () {
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
