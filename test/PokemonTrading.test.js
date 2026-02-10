const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonTrading", function () {
  let pokemonNFT;
  let pokemonTrading;
  let owner;
  let seller;
  let buyer;
  let bidder;

  beforeEach(async function () {
    [owner, seller, buyer, bidder] = await ethers.getSigners();

    const PokemonNFT = await ethers.getContractFactory("PokemonNFT");
    pokemonNFT = await PokemonNFT.deploy();

    const PokemonTrading = await ethers.getContractFactory("PokemonTrading");
    pokemonTrading = await PokemonTrading.deploy(await pokemonNFT.getAddress());

    await pokemonNFT.mint(
      seller.address,
      "ipfs://test1",
      "Pikachu",
      "Electric",
      35,
      55,
      40,
      3
    );
    await pokemonNFT.mint(
      seller.address,
      "ipfs://test2",
      "Charizard",
      "Fire",
      78,
      84,
      78,
      5
    );
  });

  describe("Fixed-price listing", function () {
    it("Should list a card", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));

      const listing = await pokemonTrading.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(ethers.parseEther("1"));
      expect(listing.active).to.be.true;
      expect(await pokemonNFT.ownerOf(0)).to.equal(await pokemonTrading.getAddress());
    });

    it("Should buy a listed card", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));

      await pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1") });

      expect(await pokemonNFT.ownerOf(0)).to.equal(buyer.address);
      expect(await pokemonTrading.pendingWithdrawals(seller.address)).to.equal(ethers.parseEther("1"));
    });

    it("Should unlist a card", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await pokemonTrading.connect(seller).unlistCard(0);

      expect(await pokemonNFT.ownerOf(0)).to.equal(seller.address);
      expect((await pokemonTrading.listings(0)).active).to.be.false;
    });
  });

  describe("Auctions", function () {
    it("Should start and settle auction", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(
        1,
        ethers.parseEther("0.5"),
        60
      );

      await pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");

      await pokemonTrading.connect(bidder).settleAuction(1);

      expect(await pokemonNFT.ownerOf(1)).to.equal(bidder.address);
      expect(await pokemonTrading.pendingWithdrawals(seller.address)).to.equal(ethers.parseEther("1"));
    });

    it("Should reject bid below minimum increment", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("1"), 60);
      await pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") });

      // 5% increment required: next min bid = 1.05 ETH
      await expect(
        pokemonTrading.connect(buyer).placeBid(1, { value: ethers.parseEther("1.02") })
      ).to.be.revertedWith("Bid below minimum increment");
    });
  });

  describe("Withdrawal", function () {
    it("Should withdraw funds", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1") });

      const before = await ethers.provider.getBalance(seller.address);
      const tx = await pokemonTrading.connect(seller).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(seller.address);

      expect(after).to.equal(before + ethers.parseEther("1") - gasUsed);
    });
  });
});
