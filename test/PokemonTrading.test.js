const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonTrading", function () {
  let pokemonNFT;
  let pokemonTrading;
  let owner;
  let seller;
  let buyer;
  let bidder;

  // Before each test:
  //   1. Deploy fresh PokemonNFT and PokemonTrading contracts.
  //   2. Mint two cards (Pikachu #0, Charizard #1) to the seller so
  //      they are available for listing and auction tests.
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
    // Seller approves the trading contract, then lists card #0 for 1 ETH.
    // Verify that:
    //   - The listing records the correct seller and price
    //   - The listing is marked as active
    //   - The NFT has been transferred (escrowed) into the trading contract
    it("Should list a card", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));

      const listing = await pokemonTrading.listings(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(ethers.parseEther("1"));
      expect(listing.active).to.be.true;
      expect(await pokemonNFT.ownerOf(0)).to.equal(await pokemonTrading.getAddress());
    });

    // After a card is listed at 1 ETH, the buyer purchases it by sending
    // the exact price. Verify that:
    //   - Ownership of the NFT transfers to the buyer
    //   - The seller's pending withdrawal balance increases by 1 ETH
    //     (pull-payment pattern — seller must withdraw separately)
    it("Should buy a listed card", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));

      await pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1") });

      expect(await pokemonNFT.ownerOf(0)).to.equal(buyer.address);
      expect(await pokemonTrading.pendingWithdrawals(seller.address)).to.equal(ethers.parseEther("1"));
    });

    // After listing a card, the seller decides to cancel (unlist) it.
    // Verify that:
    //   - The NFT is returned to the seller
    //   - The listing is marked as inactive
    it("Should unlist a card", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await pokemonTrading.connect(seller).unlistCard(0);

      expect(await pokemonNFT.ownerOf(0)).to.equal(seller.address);
      expect((await pokemonTrading.listings(0)).active).to.be.false;
    });
  });

  describe("Auctions", function () {
    // Full auction lifecycle:
    //   1. Seller starts a 60-second auction for card #1 with a 0.5 ETH floor.
    //   2. Bidder places a 1 ETH bid.
    //   3. Fast-forward time past the auction deadline (61 seconds).
    //   4. Bidder settles the auction.
    // Verify that:
    //   - The NFT transfers to the winning bidder
    //   - The seller's pending withdrawal balance equals the winning bid (1 ETH)
    it("Should start and settle auction", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(
        1,
        ethers.parseEther("0.5"),
        60
      );

      await pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") });

      // Advance the blockchain clock past the 60-second auction duration
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");

      await pokemonTrading.connect(bidder).settleAuction(1);

      expect(await pokemonNFT.ownerOf(1)).to.equal(bidder.address);
      expect(await pokemonTrading.pendingWithdrawals(seller.address)).to.equal(ethers.parseEther("1"));
    });

    // The contract enforces a 5% minimum bid increment over the current
    // highest bid. With an existing 1 ETH bid, the next valid bid must be
    // at least 1.05 ETH. A bid of 1.02 ETH should be rejected.
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
    // After a sale, the seller's funds sit in the contract (pull-payment
    // pattern to prevent re-entrancy). This test:
    //   1. Completes a 1 ETH sale so the seller has a pending balance.
    //   2. Records the seller's ETH balance before withdrawal.
    //   3. Calls withdraw() and accounts for gas cost.
    //   4. Verifies the seller's balance increased by exactly 1 ETH (minus gas).
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
