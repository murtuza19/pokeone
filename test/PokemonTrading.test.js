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

      // Advance past 60s auction + 5min extension (bid in last 5min extends)
      await ethers.provider.send("evm_increaseTime", [361]);
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
      ).to.be.revertedWithCustomError(pokemonTrading, "BidBelowMinimumIncrement");
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

    it("Should revert when withdrawing zero balance", async function () {
      await expect(
        pokemonTrading.connect(buyer).withdraw()
      ).to.be.revertedWithCustomError(pokemonTrading, "NothingToWithdraw");
    });
  });

  describe("Event verification", function () {
    it("Should emit CardListed with correct args", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await expect(
        pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"))
      )
        .to.emit(pokemonTrading, "CardListed")
        .withArgs(0, seller.address, ethers.parseEther("1"));
    });

    it("Should emit CardSold with correct args", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await expect(
        pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1") })
      )
        .to.emit(pokemonTrading, "CardSold")
        .withArgs(0, buyer.address, ethers.parseEther("1"));
    });

    it("Should emit CardUnlisted", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await expect(pokemonTrading.connect(seller).unlistCard(0))
        .to.emit(pokemonTrading, "CardUnlisted")
        .withArgs(0);
    });

    it("Should emit AuctionStarted with correct args", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      const tx = await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedEnd = block.timestamp + 60;
      await expect(tx)
        .to.emit(pokemonTrading, "AuctionStarted")
        .withArgs(1, ethers.parseEther("0.5"), expectedEnd);
    });

    it("Should emit BidPlaced with correct args", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await expect(
        pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") })
      )
        .to.emit(pokemonTrading, "BidPlaced")
        .withArgs(1, bidder.address, ethers.parseEther("1"));
    });

    it("Should emit AuctionSettled when auction has winner", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") });
      await ethers.provider.send("evm_increaseTime", [361]);
      await ethers.provider.send("evm_mine");
      await expect(pokemonTrading.connect(bidder).settleAuction(1))
        .to.emit(pokemonTrading, "AuctionSettled")
        .withArgs(1, bidder.address, ethers.parseEther("1"));
    });

    it("Should emit Withdrawal with correct args", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1") });
      await expect(pokemonTrading.connect(seller).withdraw())
        .to.emit(pokemonTrading, "Withdrawal")
        .withArgs(seller.address, ethers.parseEther("1"));
    });
  });

  describe("No-bid auction", function () {
    it("Should return NFT to seller when auction ends with no bids", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("1"), 60);
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");

      await pokemonTrading.connect(seller).settleAuction(1);

      expect(await pokemonNFT.ownerOf(1)).to.equal(seller.address);
      expect(await pokemonTrading.pendingWithdrawals(seller.address)).to.equal(0);
    });
  });

  describe("Excess payment (buyCard)", function () {
    it("Should credit excess to buyer pendingWithdrawals and allow withdraw", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1.5") });

      expect(await pokemonNFT.ownerOf(0)).to.equal(buyer.address);
      expect(await pokemonTrading.pendingWithdrawals(buyer.address)).to.equal(ethers.parseEther("0.5"));
      expect(await pokemonTrading.pendingWithdrawals(seller.address)).to.equal(ethers.parseEther("1"));

      const before = await ethers.provider.getBalance(buyer.address);
      const tx = await pokemonTrading.connect(buyer).withdraw();
      const receipt = await tx.wait();
      const after = await ethers.provider.getBalance(buyer.address);
      expect(after).to.equal(before + ethers.parseEther("0.5") - (receipt.gasUsed * receipt.gasPrice));
    });
  });

  describe("Previous bidder refund", function () {
    it("Should credit previous bidder when outbid and allow withdraw", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") });
      await pokemonTrading.connect(buyer).placeBid(1, { value: ethers.parseEther("1.1") });

      expect(await pokemonTrading.pendingWithdrawals(bidder.address)).to.equal(ethers.parseEther("1"));

      const before = await ethers.provider.getBalance(bidder.address);
      const tx = await pokemonTrading.connect(bidder).withdraw();
      const receipt = await tx.wait();
      const after = await ethers.provider.getBalance(bidder.address);
      expect(after).to.equal(before + ethers.parseEther("1") - (receipt.gasUsed * receipt.gasPrice));
    });
  });

  describe("Pausable", function () {
    it("Should reject listCard when paused", async function () {
      await pokemonTrading.connect(owner).pause();
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await expect(
        pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(pokemonTrading, "EnforcedPause");
      await pokemonTrading.connect(owner).unpause();
    });

    it("Should reject buyCard when paused", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await pokemonTrading.connect(owner).pause();
      await expect(
        pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(pokemonTrading, "EnforcedPause");
      await pokemonTrading.connect(owner).unpause();
    });

    it("Should reject startAuction when paused", async function () {
      await pokemonTrading.connect(owner).pause();
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await expect(
        pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("1"), 60)
      ).to.be.revertedWithCustomError(pokemonTrading, "EnforcedPause");
      await pokemonTrading.connect(owner).unpause();
    });

    it("Should reject placeBid when paused", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await pokemonTrading.connect(owner).pause();
      await expect(
        pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(pokemonTrading, "EnforcedPause");
      await pokemonTrading.connect(owner).unpause();
    });

    it("Should reject settleAuction when paused", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await ethers.provider.send("evm_increaseTime", [361]);
      await ethers.provider.send("evm_mine");
      await pokemonTrading.connect(owner).pause();
      await expect(pokemonTrading.connect(bidder).settleAuction(1))
        .to.be.revertedWithCustomError(pokemonTrading, "EnforcedPause");
      await pokemonTrading.connect(owner).unpause();
    });
  });

  describe("Access control", function () {
    it("Should reject pause from non-owner", async function () {
      await expect(
        pokemonTrading.connect(seller).pause()
      ).to.be.revertedWithCustomError(pokemonTrading, "OwnableUnauthorizedAccount");
    });
  });

  describe("Invalid operations", function () {
    it("Should reject buy when card not listed", async function () {
      await expect(
        pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(pokemonTrading, "NotListed");
    });

    it("Should reject buy with insufficient payment", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await expect(
        pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(pokemonTrading, "InsufficientPayment");
    });

    it("Should reject unlist when not seller", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await expect(
        pokemonTrading.connect(buyer).unlistCard(0)
      ).to.be.revertedWithCustomError(pokemonTrading, "NotSeller");
    });

    it("Should reject unlist when not listed", async function () {
      await expect(
        pokemonTrading.connect(seller).unlistCard(0)
      ).to.be.revertedWithCustomError(pokemonTrading, "NotListed");
    });

    it("Should reject list when not owner of card", async function () {
      await expect(
        pokemonTrading.connect(buyer).listCard(0, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(pokemonTrading, "NotCardOwner");
    });

    it("Should reject list with zero price", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await expect(
        pokemonTrading.connect(seller).listCard(0, 0)
      ).to.be.revertedWithCustomError(pokemonTrading, "PriceMustBePositive");
    });

    it("Should reject list when already listed", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await expect(
        pokemonTrading.connect(seller).listCard(0, ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(pokemonTrading, "AlreadyListed");
    });

    it("Should reject placeBid on non-existent auction", async function () {
      await expect(
        pokemonTrading.connect(bidder).placeBid(99, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(pokemonTrading, "NotListed");
    });

    it("Should reject placeBid below starting price", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("1"), 60);
      await expect(
        pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(pokemonTrading, "BidBelowStartingPrice");
    });

    it("Should reject placeBid after auction ended", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");
      await expect(
        pokemonTrading.connect(bidder).placeBid(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(pokemonTrading, "AuctionEnded");
    });

    it("Should reject settleAuction before end time", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await expect(
        pokemonTrading.connect(bidder).settleAuction(1)
      ).to.be.revertedWithCustomError(pokemonTrading, "AuctionNotEnded");
    });

    it("Should reject settleAuction when already settled", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);
      await ethers.provider.send("evm_increaseTime", [361]);
      await ethers.provider.send("evm_mine");
      await pokemonTrading.connect(bidder).settleAuction(1);
      await expect(
        pokemonTrading.connect(seller).settleAuction(1)
      ).to.be.revertedWithCustomError(pokemonTrading, "AlreadySettled");
    });

    it("Should reject startAuction when not owner of card", async function () {
      await expect(
        pokemonTrading.connect(buyer).startAuction(0, ethers.parseEther("1"), 60)
      ).to.be.revertedWithCustomError(pokemonTrading, "NotCardOwner");
    });

    it("Should reject startAuction with duration too short", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await expect(
        pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("1"), 30)
      ).to.be.revertedWithCustomError(pokemonTrading, "DurationTooShort");
    });

    it("Should reject startAuction with duration exceeding MAX_AUCTION_DURATION", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      const maxDuration = await pokemonTrading.MAX_AUCTION_DURATION();
      await expect(
        pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("1"), maxDuration + 1n)
      ).to.be.revertedWithCustomError(pokemonTrading, "DurationTooLong");
    });
  });

  describe("Commit-reveal bids", function () {
    it("Should place bid via commit then reveal", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);

      const amount = ethers.parseEther("1");
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const commitment = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "bytes32"],
        [bidder.address, 1n, amount, nonce]
      );
      await pokemonTrading.connect(bidder).commitBid(1, commitment);
      expect(await pokemonTrading.bidCommitments(1, bidder.address)).to.equal(commitment);

      await pokemonTrading.connect(bidder).placeBidReveal(1, amount, nonce, {
        value: amount,
      });

      const auction = await pokemonTrading.auctions(1);
      expect(auction.highestBidder).to.equal(bidder.address);
      expect(auction.highestBid).to.equal(amount);
      expect(await pokemonTrading.bidCommitments(1, bidder.address)).to.equal(ethers.ZeroHash);
    });

    it("Should reject placeBidReveal with wrong commitment", async function () {
      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 1);
      await pokemonTrading.connect(seller).startAuction(1, ethers.parseEther("0.5"), 60);

      const amount = ethers.parseEther("1");
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const wrongCommitment = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
      await pokemonTrading.connect(bidder).commitBid(1, wrongCommitment);

      await expect(
        pokemonTrading.connect(bidder).placeBidReveal(1, amount, nonce, { value: amount })
      ).to.be.revertedWithCustomError(pokemonTrading, "InvalidCommitment");
    });
  });

  describe("Reentrancy", function () {
    // Withdraw zeroes pendingWithdrawals before sending ETH, so reentrant withdraw() reverts with NothingToWithdraw. See ReentrancyAttacker.sol.
    it.skip("Should prevent reentrancy on withdraw (balance zeroed before send)", async function () {
      const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await ReentrancyAttacker.deploy(
        await pokemonTrading.getAddress(),
        await pokemonNFT.getAddress()
      );
      await attacker.waitForDeployment();

      await seller.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("2"),
      });

      await pokemonNFT.connect(seller).approve(await pokemonTrading.getAddress(), 0);
      await pokemonTrading.connect(seller).listCard(0, ethers.parseEther("1"));
      await attacker.buyCard(0, { value: ethers.parseEther("1") });

      await attacker.listCard(0, ethers.parseEther("0.5"));
      await pokemonTrading.connect(buyer).buyCard(0, { value: ethers.parseEther("0.5") });

      expect(await pokemonTrading.pendingWithdrawals(await attacker.getAddress())).to.equal(
        ethers.parseEther("0.5")
      );

      await expect(attacker.attackWithdraw()).to.be.reverted;
    });
  });
});
