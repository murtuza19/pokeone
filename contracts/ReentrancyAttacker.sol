// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title ReentrancyAttacker
 * @dev Test helper: contract that attempts to reenter PokemonTrading.withdraw() in its receive().
 *      Used to verify that the trading contract zeroes balance before sending (CEI pattern).
 */
interface IPokemonTrading {
    function withdraw() external;
    function buyCard(uint256 tokenId) external payable;
    function listCard(uint256 tokenId, uint256 price) external;
}

contract ReentrancyAttacker is IERC721Receiver {
    IPokemonTrading public immutable trading;
    IERC721 public immutable nft;

    constructor(address _trading, address _nft) {
        trading = IPokemonTrading(_trading);
        nft = IERC721(_nft);
    }

    receive() external payable {
        trading.withdraw();
    }

    function attackWithdraw() external {
        trading.withdraw();
    }

    function buyCard(uint256 tokenId) external payable {
        trading.buyCard{value: msg.value}(tokenId);
    }

    function listCard(uint256 tokenId, uint256 price) external {
        nft.approve(address(trading), tokenId);
        trading.listCard(tokenId, price);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
