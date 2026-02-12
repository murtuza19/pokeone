# PokeOne - Decentralized Pokémon Card Trading Platform

UCL DeFi Coursework 1: A decentralized application (dApp) for trading Pokémon cards on a local Ethereum testnet.

## Features

- **ERC721 NFT Contract**: Pokémon cards with on-chain metadata (name, type, HP, attack, defense, rarity)
- **Trading Contract**: Fixed-price sales and English auctions
- **Security**: ReentrancyGuard, Pausable, Ownable, pull-over-push withdrawals, minimum bid increment (front-running mitigation)
- **Frontend**: React app with wallet connection, marketplace, search/filter, mint form, and trading interfaces. Mobile-responsive.

## Prerequisites

- Node.js 18+
- MetaMask (or compatible wallet)
- npm or yarn

## Setup

### 1. Install Dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Compile Contracts

```bash
npm run compile
```

### 3. Run Local Testnet

In one terminal:

```bash
npm run node
```

### 4. Deploy Contracts

In another terminal:

```bash
npm run deploy
```

Save the output addresses for the frontend.

### 5. Configure Frontend

Create `frontend/.env`:

```
VITE_POKEMON_NFT_ADDRESS=<PokemonNFT address from deploy>
VITE_POKEMON_TRADING_ADDRESS=<PokemonTrading address from deploy>
```

### 6. Add MetaMask Network

- Network Name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency: ETH

Import the test accounts below into MetaMask using their private keys.

### Test Accounts

Hardhat provides 20 pre-funded accounts (10,000 ETH each). Use the following for testing:

| Account | Address | Private Key | Role |
|---------|---------|-------------|------|
| #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` | **Owner / Minter** — deploys contracts and mints new cards |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` | **Buyer / Bidder** — purchases listed cards and places auction bids |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` | **Second Buyer** — useful for testing competing bids |

**Recommended testing flow:**

1. Connect with **Account #0** to mint Pokemon cards
2. List a card for sale or start an auction (still as Account #0)
3. Switch to **Account #1** in MetaMask to buy the listed card or place a bid
4. Switch to **Account #2** to place a competing bid (auction testing)
5. Switch back to **Account #0** to withdraw sale/auction proceeds

> Only Account #0 can mint cards because it is the contract owner. All other accounts can buy, bid, list (cards they own), and withdraw.

### 7. Run Frontend

```bash
cd frontend && npm run dev
```

Open http://localhost:3000

### 8. Seed Demo Cards (Optional)

The deployer is the NFT owner. Mint cards via the "Mint Pokemon Card" section in the UI, or run:

```bash
set POKEMON_NFT_ADDRESS=<nft-address>
npx hardhat run scripts/seed.js --network localhost
```

## Project Structure

```
Pokeone/
├── contracts/
│   ├── PokemonNFT.sol       # ERC721 Pokémon cards
│   └── PokemonTrading.sol   # Fixed-price + auction trading
├── scripts/
│   ├── deploy.js
│   └── seed.js
├── test/
│   ├── PokemonNFT.test.js
│   └── PokemonTrading.test.js
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── components/      # Marketplace, CardDetail, ListCard, MintCard, FilterSelect, TypeSelect, WalletConnect
│   │   ├── contexts/        # Web3Context
│   │   ├── hooks/
│   │   └── config.js
│   └── .env.example
├── hardhat.config.js
└── README.md
```

## Architecture

```mermaid
flowchart TB
    subgraph Frontend
        UI[React App]
        Wallet[Wallet Connect]
        Marketplace[Marketplace]
        MintCard[Mint Card]
        UI --> Wallet
        UI --> Marketplace
        UI --> MintCard
    end

    subgraph Blockchain
        NFT[PokemonNFT ERC721]
        Trading[PokemonTrading]
        NFT -->|transfer| Trading
        Trading -->|transfer| NFT
    end

    subgraph Users
        Seller[Seller]
        Buyer[Buyer]
    end

    Marketplace -->|ethers.js| NFT
    Marketplace -->|ethers.js| Trading
    MintCard -->|ethers.js| NFT
    Wallet -->|MetaMask| Users
```

### Frontend Components

- **Web3Context**: Shared wallet state, contract instances, owner check. Used by all components.
- **WalletConnect**: Connect/disconnect, network switch, Welcome Minter/Buyer labels.
- **Marketplace**: Listings, auctions, My Cards, search/filter (name, type, rarity), event listeners.
- **CardDetail**: Modal for buy, bid, settle, unlist. Card stats, image, seller info.
- **ListCard**: List card for fixed price or auction.
- **MintCard**: Mint form (owner only). Name, type, stats, image URL.
- **FilterSelect**: Custom dropdown for search filters with type colors.

### Smart Contracts

- **PokemonNFT**: ERC721 with URI storage, Ownable, Pausable. Owner mints cards with metadata.
- **PokemonTrading**: Accepts NFT transfers for listing. Implements fixed-price `buyCard` and auction `placeBid`/`settleAuction`. Uses pull-over-push for secure withdrawals.

### Security Measures

- **ReentrancyGuard**: On all state-changing functions in PokemonTrading
- **Pausable**: Emergency stop on both contracts
- **Ownable**: Restricted minting to owner
- **Pull-over-push**: Sellers withdraw via `withdraw()` instead of direct transfers
- **Front-running mitigation**: 5% minimum bid increment on auctions
- **Integer overflow**: Solidity 0.8.x built-in checks

## Testing

```bash
npm test
```

## Scripts

| Script        | Description                    |
|---------------|--------------------------------|
| `npm run compile` | Compile Solidity contracts |
| `npm run test`    | Run test suite            |
| `npm run node`    | Start Hardhat local node  |
| `npm run deploy`  | Deploy to localhost       |

## License

ISC
