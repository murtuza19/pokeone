// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error NotCardOwner();
error PriceMustBePositive();
error AlreadyListed();
error NotSeller();
error NotListed();
error InsufficientPayment();
error InvalidStartingPrice();
error DurationTooShort();
error AuctionAlreadyExists();
error AuctionEnded();
error AuctionAlreadySettled();
error BidBelowStartingPrice();
error BidBelowMinimumIncrement();
error AuctionNotEnded();
error AlreadySettled();
error NothingToWithdraw();
error TransferFailed();
error DurationTooLong();
error InvalidCommitment();

/**
 * @title PokemonTrading
 * @dev Trading contract for Pokemon cards - fixed-price sales and auctions
 */
contract PokemonTrading is ReentrancyGuard, Pausable, Ownable {
    IERC721 public immutable pokemonNFT;

    /// @dev Minimum bid increment (5%) to mitigate front-running - new bid must exceed previous by at least this
    uint256 public constant MIN_BID_INCREMENT_BPS = 500; // 5%

    /// @dev If a bid is placed within this time before end, auction extends by this duration (sniping mitigation)
    uint256 public constant AUCTION_EXTENSION_DURATION = 5 minutes;

    /// @dev Maximum auction duration to prevent extremely long-lived auctions
    uint256 public constant MAX_AUCTION_DURATION = 30 days;

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }
    mapping(uint256 => Listing) public listings;

    struct Auction {
        address seller;
        uint256 startingPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool settled;
    }
    mapping(uint256 => Auction) public auctions;

    /// @dev Pull-over-push: balances for withdrawal
    mapping(address => uint256) public pendingWithdrawals;

    /// @dev Commit-reveal: tokenId => bidder => commitment hash (keccak256(bidder, tokenId, amount, nonce))
    mapping(uint256 => mapping(address => bytes32)) public bidCommitments;

    event CardListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event CardUnlisted(uint256 indexed tokenId);
    event CardSold(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event AuctionStarted(uint256 indexed tokenId, uint256 startingPrice, uint256 endTime);
    event BidCommitted(uint256 indexed tokenId, address indexed bidder, bytes32 commitment);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount);
    event Withdrawal(address indexed recipient, uint256 amount);

    constructor(address _pokemonNFT) Ownable(msg.sender) {
        pokemonNFT = IERC721(_pokemonNFT);
    }

    /**
     * @dev List a card for fixed-price sale
     * @param tokenId The NFT token ID to list
     * @param price Sale price in wei
     */
    function listCard(uint256 tokenId, uint256 price) external whenNotPaused nonReentrant {
        if (listings[tokenId].active) revert AlreadyListed();
        if (pokemonNFT.ownerOf(tokenId) != msg.sender) revert NotCardOwner();
        if (price == 0) revert PriceMustBePositive();

        pokemonNFT.transferFrom(msg.sender, address(this), tokenId);

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit CardListed(tokenId, msg.sender, price);
    }

    /**
     * @dev Unlist a card (returns to seller)
     * @param tokenId The listed token ID to remove
     */
    function unlistCard(uint256 tokenId) external whenNotPaused nonReentrant {
        if (!listings[tokenId].active) revert NotListed();
        if (listings[tokenId].seller != msg.sender) revert NotSeller();

        listings[tokenId].active = false;
        pokemonNFT.transferFrom(address(this), msg.sender, tokenId);

        emit CardUnlisted(tokenId);
    }

    /**
     * @dev Buy a listed card. Excess payment is credited to buyer's pendingWithdrawals (pull pattern).
     * @param tokenId The listed token ID to purchase
     */
    function buyCard(uint256 tokenId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed();
        if (msg.value < listing.price) revert InsufficientPayment();

        uint256 price = listing.price;
        listing.active = false;

        pendingWithdrawals[listing.seller] += price;
        uint256 excess = msg.value - price;
        if (excess > 0) {
            pendingWithdrawals[msg.sender] += excess;
        }

        pokemonNFT.transferFrom(address(this), msg.sender, tokenId);

        emit CardSold(tokenId, msg.sender, price);
    }

    /**
     * @dev Start an auction
     * @param tokenId The NFT token ID to auction
     * @param startingPrice Minimum first bid in wei
     * @param duration Auction duration in seconds (minimum 1 minute)
     */
    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 duration)
        external
        whenNotPaused
        nonReentrant
    {
        if (pokemonNFT.ownerOf(tokenId) != msg.sender) revert NotCardOwner();
        if (startingPrice == 0) revert InvalidStartingPrice();
        if (duration < 1 minutes) revert DurationTooShort();
        if (duration > MAX_AUCTION_DURATION) revert DurationTooLong();
        if (auctions[tokenId].endTime != 0 && !auctions[tokenId].settled) revert AuctionAlreadyExists();

        pokemonNFT.transferFrom(msg.sender, address(this), tokenId);

        auctions[tokenId] = Auction({
            seller: msg.sender,
            startingPrice: startingPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + duration,
            settled: false
        });

        emit AuctionStarted(tokenId, startingPrice, block.timestamp + duration);
    }

    /**
     * @dev Place a bid on an auction. Minimum 5% increment over previous bid.
     *      If bid is placed in the last AUCTION_EXTENSION_DURATION, auction end time extends (sniping mitigation).
     * @param tokenId The auctioned token ID
     */
    function placeBid(uint256 tokenId) external payable whenNotPaused nonReentrant {
        Auction storage auction = auctions[tokenId];
        if (auction.endTime == 0) revert NotListed();
        if (block.timestamp >= auction.endTime) revert AuctionEnded();
        if (auction.settled) revert AuctionAlreadySettled();
        if (msg.value < auction.startingPrice) revert BidBelowStartingPrice();

        uint256 minBid = auction.highestBidder == address(0)
            ? auction.startingPrice
            : auction.highestBid + (auction.highestBid * MIN_BID_INCREMENT_BPS / 10000);
        if (msg.value < minBid) revert BidBelowMinimumIncrement();

        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        if (auction.endTime - block.timestamp <= AUCTION_EXTENSION_DURATION) {
            auction.endTime = block.timestamp + AUCTION_EXTENSION_DURATION;
        }

        emit BidPlaced(tokenId, msg.sender, msg.value);
    }

    /**
     * @dev Commit-reveal phase 1: submit commitment = keccak256(abi.encodePacked(msg.sender, tokenId, amount, nonce)).
     *      Front-running mitigation: bid amount is hidden until reveal.
     * @param tokenId The auctioned token ID
     * @param commitment keccak256(abi.encodePacked(msg.sender, tokenId, amount, nonce)) from off-chain
     */
    function commitBid(uint256 tokenId, bytes32 commitment) external whenNotPaused nonReentrant {
        Auction storage auction = auctions[tokenId];
        if (auction.endTime == 0) revert NotListed();
        if (block.timestamp >= auction.endTime) revert AuctionEnded();
        if (auction.settled) revert AuctionAlreadySettled();
        bidCommitments[tokenId][msg.sender] = commitment;
        emit BidCommitted(tokenId, msg.sender, commitment);
    }

    /**
     * @dev Commit-reveal phase 2: reveal (amount, nonce) and place bid. Requires prior commitBid with matching hash.
     *      msg.value must be >= amount; excess is credited to pendingWithdrawals.
     * @param tokenId The auctioned token ID
     * @param amount Bid amount in wei
     * @param nonce Secret used in commitment
     */
    function placeBidReveal(uint256 tokenId, uint256 amount, bytes32 nonce)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        bytes32 expected = keccak256(abi.encodePacked(msg.sender, tokenId, amount, nonce));
        if (bidCommitments[tokenId][msg.sender] != expected) revert InvalidCommitment();
        delete bidCommitments[tokenId][msg.sender];

        Auction storage auction = auctions[tokenId];
        if (auction.endTime == 0) revert NotListed();
        if (block.timestamp >= auction.endTime) revert AuctionEnded();
        if (auction.settled) revert AuctionAlreadySettled();
        if (msg.value < amount) revert InsufficientPayment();
        if (amount < auction.startingPrice) revert BidBelowStartingPrice();

        uint256 minBid = auction.highestBidder == address(0)
            ? auction.startingPrice
            : auction.highestBid + (auction.highestBid * MIN_BID_INCREMENT_BPS / 10000);
        if (amount < minBid) revert BidBelowMinimumIncrement();

        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = amount;
        auction.highestBidder = msg.sender;

        uint256 excess = msg.value - amount;
        if (excess > 0) {
            pendingWithdrawals[msg.sender] += excess;
        }

        if (auction.endTime - block.timestamp <= AUCTION_EXTENSION_DURATION) {
            auction.endTime = block.timestamp + AUCTION_EXTENSION_DURATION;
        }

        emit BidPlaced(tokenId, msg.sender, amount);
    }

    /**
     * @dev Settle auction after it ends. Winner gets NFT; seller gets proceeds. No bids returns NFT to seller.
     * @param tokenId The auctioned token ID
     */
    function settleAuction(uint256 tokenId) external whenNotPaused nonReentrant {
        Auction storage auction = auctions[tokenId];
        if (auction.endTime == 0) revert NotListed();
        if (block.timestamp < auction.endTime) revert AuctionNotEnded();
        if (auction.settled) revert AlreadySettled();

        auction.settled = true;

        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.seller] += auction.highestBid;
            pokemonNFT.transferFrom(address(this), auction.highestBidder, tokenId);
            emit AuctionSettled(tokenId, auction.highestBidder, auction.highestBid);
        } else {
            pokemonNFT.transferFrom(address(this), auction.seller, tokenId);
        }
    }

    /**
     * @dev Withdraw accumulated funds (pull-over-push pattern)
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }

    /// @dev Pauses all listing, buying, bidding, and settling (emergency stop)
    function pause() external onlyOwner {
        _pause();
    }

    /// @dev Resumes trading after pause
    function unpause() external onlyOwner {
        _unpause();
    }
}
