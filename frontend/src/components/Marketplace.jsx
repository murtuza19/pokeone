import { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { CardDetail } from './CardDetail';
import { ListCard } from './ListCard';
import { formatEther } from 'ethers';

function WithdrawButton({ pokemonTrading, amount, onWithdrawn }) {
  const [txPending, setTxPending] = useState(false);
  const handleWithdraw = async () => {
    setTxPending(true);
    try {
      const tx = await pokemonTrading.withdraw();
      await tx.wait();
      onWithdrawn();
    } catch (err) {
      console.error(err);
    } finally {
      setTxPending(false);
    }
  };
  return (
    <button onClick={handleWithdraw} disabled={txPending} className="btn btn-outline">
      {txPending ? 'Withdrawing...' : `Withdraw ${formatEther(amount)} ETH`}
    </button>
  );
}

const RARITY_LABELS = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const TYPE_COLORS = {
  Fire: '#ff6b35',
  Water: '#4ecdc4',
  Electric: '#ffe66d',
  Grass: '#95e1a3',
  Psychic: '#a855f7',
  Fighting: '#f97316',
  default: '#94a3b8',
};

function getTypeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.default;
}

export function Marketplace() {
  const { pokemonNFT, pokemonTrading, account } = useWeb3();
  const [listings, setListings] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [pendingBalance, setPendingBalance] = useState(0n);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showListModal, setShowListModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!pokemonNFT || !pokemonTrading) return;
    setLoading(true);
    try {
      const totalSupply = 20;
      const tokens = [];
      for (let i = 0; i < totalSupply; i++) {
        try {
          const owner = await pokemonNFT.ownerOf(i);
          if (owner && owner !== '0x0000000000000000000000000000000000000000') {
            tokens.push(i);
          }
        } catch {
          break;
        }
      }
      setAllTokens(tokens);

      const listed = [];
      const auctioned = [];
      for (const tid of tokens) {
        const listing = await pokemonTrading.listings(tid);
        if (listing.active) {
          const card = await pokemonNFT.getCard(tid);
          listed.push({ tokenId: tid, ...card, price: listing.price, seller: listing.seller });
        }
        const auction = await pokemonTrading.auctions(tid);
        if (!auction.settled && auction.endTime > 0n && BigInt(Math.floor(Date.now() / 1000)) < auction.endTime) {
          const card = await pokemonNFT.getCard(tid);
          auctioned.push({
            tokenId: tid,
            ...card,
            highestBid: auction.highestBid,
            endTime: auction.endTime,
            seller: auction.seller,
          });
        }
      }
      setListings(listed);
      setAuctions(auctioned);

      if (account) {
        const mine = [];
        for (const tid of tokens) {
          const owner = await pokemonNFT.ownerOf(tid);
          if (owner?.toLowerCase() === account.toLowerCase()) {
            const card = await pokemonNFT.getCard(tid);
            mine.push({ tokenId: tid, ...card });
          }
        }
        setMyCards(mine);
        const pending = await pokemonTrading.pendingWithdrawals(account);
        setPendingBalance(pending);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (!pokemonNFT || !pokemonTrading) return;
    const nft = pokemonNFT;
    const trading = pokemonTrading;

    const onTransfer = () => loadData();
    const onListed = () => loadData();
    const onSold = () => loadData();
    const onAuction = () => loadData();
    const onBid = () => loadData();
    const onSettled = () => loadData();

    nft.on('Transfer', onTransfer);
    trading.on('CardListed', onListed);
    trading.on('CardSold', onSold);
    trading.on('CardUnlisted', onListed);
    trading.on('AuctionStarted', onAuction);
    trading.on('BidPlaced', onBid);
    trading.on('AuctionSettled', onSettled);

    return () => {
      nft.removeAllListeners?.();
      trading.removeAllListeners?.();
    };
  }, [pokemonNFT, pokemonTrading, account]);

  if (!pokemonNFT || !pokemonTrading) {
    return (
      <div className="marketplace-placeholder">
        <p>Connect wallet and ensure contract addresses are configured.</p>
        <p className="hint">Deploy contracts with <code>npm run deploy</code> and set VITE_POKEMON_NFT_ADDRESS and VITE_POKEMON_TRADING_ADDRESS.</p>
      </div>
    );
  }

  return (
    <div className="marketplace">
      <div className="marketplace-header">
        <h2>Marketplace</h2>
        <div className="header-actions">
          {pendingBalance > 0n && (
            <WithdrawButton pokemonTrading={pokemonTrading} amount={pendingBalance} onWithdrawn={loadData} />
          )}
          {account && (
            <button onClick={() => setShowListModal(true)} className="btn btn-primary">
              List a Card
            </button>
          )}
        </div>
      </div>

      {loading && <p className="loading">Loading...</p>}

      <section className="section">
        <h3>Fixed Price Listings</h3>
        <div className="card-grid">
          {listings.map((item) => (
            <CardTile
              key={item.tokenId}
              item={item}
              type="listing"
              onClick={() => setSelectedCard({ ...item, mode: 'listing' })}
              getTypeColor={getTypeColor}
              RARITY_LABELS={RARITY_LABELS}
            />
          ))}
        </div>
        {listings.length === 0 && !loading && <p className="empty">No listings</p>}
      </section>

      <section className="section">
        <h3>Auctions</h3>
        <div className="card-grid">
          {auctions.map((item) => (
            <CardTile
              key={item.tokenId}
              item={item}
              type="auction"
              onClick={() => setSelectedCard({ ...item, mode: 'auction' })}
              getTypeColor={getTypeColor}
              RARITY_LABELS={RARITY_LABELS}
            />
          ))}
        </div>
        {auctions.length === 0 && !loading && <p className="empty">No active auctions</p>}
      </section>

      {account && myCards.length > 0 && (
        <section className="section">
          <h3>My Cards</h3>
          <div className="card-grid">
            {myCards.map((item) => (
              <CardTile
                key={item.tokenId}
                item={item}
                type="mine"
                onClick={() => setSelectedCard({ ...item, mode: 'mine' })}
                getTypeColor={getTypeColor}
                RARITY_LABELS={RARITY_LABELS}
              />
            ))}
          </div>
        </section>
      )}

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={loadData}
          pokemonNFT={pokemonNFT}
          pokemonTrading={pokemonTrading}
          account={account}
          getTypeColor={getTypeColor}
          RARITY_LABELS={RARITY_LABELS}
        />
      )}

      {showListModal && (
        <ListCard
          myCards={myCards}
          onClose={() => setShowListModal(false)}
          onListed={loadData}
          pokemonNFT={pokemonNFT}
          pokemonTrading={pokemonTrading}
        />
      )}
    </div>
  );
}

function CardTile({ item, type, onClick, getTypeColor, RARITY_LABELS }) {
  const price = item.price ? `${Number(item.price) / 1e18} ETH` : null;
  const bid = item.highestBid ? `${Number(item.highestBid) / 1e18} ETH` : null;

  return (
    <div
      className="card-tile"
      onClick={onClick}
      style={{ '--type-color': getTypeColor(item.pokemonType) }}
    >
      <div className="card-tile-header">
        <span className="type-badge">{item.pokemonType}</span>
        <span className="rarity">{RARITY_LABELS[item.rarity]}</span>
      </div>
      <div className="card-tile-name">{item.name}</div>
      <div className="card-tile-stats">
        HP {item.hp} | ATK {item.attack} | DEF {item.defense}
      </div>
      {type === 'listing' && price && <div className="card-tile-price">{price}</div>}
      {type === 'auction' && (
        <div className="card-tile-auction">
          {bid ? `Highest: ${bid}` : 'No bids'}
        </div>
      )}
    </div>
  );
}
