// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PokemonTrading
 * @dev Trading contract for Pokemon cards - fixed-price sales and auctions
 */
contract PokemonTrading is ReentrancyGuard, Pausable, Ownable {
    IERC721 public immutable pokemonNFT;

    /// @dev Minimum bid increment (5%) to mitigate front-running - new bid must exceed previous by at least this
    uint256 public constant MIN_BID_INCREMENT_BPS = 500; // 5%

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

    event CardListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event CardUnlisted(uint256 indexed tokenId);
    event CardSold(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event AuctionStarted(uint256 indexed tokenId, uint256 startingPrice, uint256 endTime);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount);
    event Withdrawal(address indexed recipient, uint256 amount);

    constructor(address _pokemonNFT) Ownable(msg.sender) {
        pokemonNFT = IERC721(_pokemonNFT);
    }

    /**
     * @dev List a card for fixed-price sale
     */
    function listCard(uint256 tokenId, uint256 price) external whenNotPaused nonReentrant {
        require(pokemonNFT.ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");
        require(!listings[tokenId].active, "Already listed");

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
     */
    function unlistCard(uint256 tokenId) external whenNotPaused nonReentrant {
        require(listings[tokenId].seller == msg.sender, "Not seller");
        require(listings[tokenId].active, "Not listed");

        listings[tokenId].active = false;
        pokemonNFT.transferFrom(address(this), msg.sender, tokenId);

        emit CardUnlisted(tokenId);
    }

    /**
     * @dev Buy a listed card
     */
    function buyCard(uint256 tokenId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not for sale");
        require(msg.value >= listing.price, "Insufficient payment");

        uint256 price = listing.price;
        listing.active = false;

        pendingWithdrawals[listing.seller] += price;
        if (msg.value > price) {
            (bool sent, ) = msg.sender.call{value: msg.value - price}("");
            require(sent, "Refund failed");
        }

        pokemonNFT.transferFrom(address(this), msg.sender, tokenId);

        emit CardSold(tokenId, msg.sender, price);
    }

    /**
     * @dev Start an auction
     */
    function startAuction(uint256 tokenId, uint256 startingPrice, uint256 duration)
        external
        whenNotPaused
        nonReentrant
    {
        require(pokemonNFT.ownerOf(tokenId) == msg.sender, "Not owner");
        require(startingPrice > 0, "Invalid starting price");
        require(duration >= 1 minutes, "Duration too short");
        require(!auctions[tokenId].settled && auctions[tokenId].endTime == 0, "Auction exists");

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
     * @dev Place a bid on an auction
     * Front-running mitigation: minimum bid increment (5%) required to outbid
     */
    function placeBid(uint256 tokenId) external payable whenNotPaused nonReentrant {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp < auction.endTime, "Auction ended");
        require(!auction.settled, "Auction settled");
        require(msg.value >= auction.startingPrice, "Below starting price");

        uint256 minBid = auction.highestBidder == address(0)
            ? auction.startingPrice
            : auction.highestBid + (auction.highestBid * MIN_BID_INCREMENT_BPS / 10000);
        require(msg.value >= minBid, "Bid below minimum increment");

        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        emit BidPlaced(tokenId, msg.sender, msg.value);
    }

    /**
     * @dev Settle auction after it ends
     */
    function settleAuction(uint256 tokenId) external whenNotPaused nonReentrant {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.settled, "Already settled");

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
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
