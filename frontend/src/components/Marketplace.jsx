import { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { CardDetail } from './CardDetail';
import { ListCard } from './ListCard';
import { FilterSelect } from './FilterSelect';
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
const TYPES = ['Fire', 'Water', 'Electric', 'Grass', 'Psychic', 'Fighting'];
const TYPE_COLORS = {
  Fire: '#ff6b35',
  Water: '#3692dc',
  Electric: '#ffcb05',
  Grass: '#5dbd63',
  Psychic: '#a855f7',
  Fighting: '#b91c1c',
  default: '#94a3b8',
};

function getTypeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.default;
}

const DEFAULT_CARD_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%231a4a7a' width='100' height='100'/%3E%3Ccircle cx='50' cy='50' r='42' fill='%23fff'/%3E%3Cpath d='M8 50 A42 42 0 0 1 92 50 Z' fill='%23e3350d'/%3E%3Cpath d='M8 50 A42 42 0 0 0 92 50 Z' fill='%23fff'/%3E%3Crect x='8' y='46' width='84' height='8' fill='%23212121'/%3E%3Ccircle cx='50' cy='50' r='10' fill='%23212121'/%3E%3Ccircle cx='48' cy='48' r='3' fill='%23fff'/%3E%3C/svg%3E";

function CardImage({ tokenURI, alt }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!tokenURI || !String(tokenURI).trim()) {
      setUrl(DEFAULT_CARD_IMAGE);
      return;
    }
    const s = String(tokenURI).trim();
    if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(s)) {
      setUrl(s);
      return;
    }
    fetch(tokenURI)
      .then((r) => r.json())
      .then((j) => setUrl(j.image || DEFAULT_CARD_IMAGE))
      .catch(() => setUrl(s));
  }, [tokenURI]);
  const displayUrl = failed || !url ? DEFAULT_CARD_IMAGE : url;
  return <img src={displayUrl} alt={alt || 'Pokemon card'} onError={() => setFailed(true)} />;
}

/** Filter cards by search query, type, and rarity */
function filterCards(items, { search, type, rarity }) {
  return items.filter((item) => {
    const nameMatch = !search.trim() || String(item.name || '').toLowerCase().includes(search.toLowerCase());
    const typeMatch = !type || (item.pokemonType || '').toLowerCase() === type.toLowerCase();
    const rarityMatch = !rarity || Number(item.rarity ?? 0) === Number(rarity);
    return nameMatch && typeMatch && rarityMatch;
  });
}

/** Normalize getCard() result - ethers can return struct as object or tuple */
function parseCard(raw) {
  return {
    name: raw.name ?? raw[0] ?? '',
    pokemonType: raw.pokemonType ?? raw[1] ?? '',
    hp: raw.hp ?? raw[2] ?? 0,
    attack: raw.attack ?? raw[3] ?? 0,
    defense: raw.defense ?? raw[4] ?? 0,
    rarity: raw.rarity ?? raw[5] ?? 1,
  };
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
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');

  const filterOpts = { search: searchQuery, type: typeFilter, rarity: rarityFilter };
  const filteredListings = filterCards(listings, filterOpts);
  const filteredAuctions = filterCards(auctions, filterOpts);
  const filteredMyCards = filterCards(myCards, filterOpts);

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

      const listed = [];
      const auctioned = [];
      for (const tid of tokens) {
        const listing = await pokemonTrading.listings(tid);
        if (listing.active) {
          const [raw, tokenURI] = await Promise.all([pokemonNFT.getCard(tid), pokemonNFT.tokenURI(tid)]);
          const card = parseCard(raw);
          listed.push({ tokenId: tid, ...card, tokenURI, price: listing.price, seller: listing.seller });
        }
        const auction = await pokemonTrading.auctions(tid);
        if (!auction.settled && auction.endTime > 0n && BigInt(Math.floor(Date.now() / 1000)) < auction.endTime) {
          const [raw, tokenURI] = await Promise.all([pokemonNFT.getCard(tid), pokemonNFT.tokenURI(tid)]);
          const card = parseCard(raw);
          auctioned.push({
            tokenId: tid,
            ...card,
            tokenURI,
            startingPrice: auction.startingPrice,
            highestBid: auction.highestBid,
            highestBidder: auction.highestBidder,
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
            const [raw, tokenURI] = await Promise.all([pokemonNFT.getCard(tid), pokemonNFT.tokenURI(tid)]);
            const card = parseCard(raw);
            mine.push({ tokenId: tid, ...card, tokenURI });
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
        <p className="hint">1. In <code>frontend/.env</code> set VITE_POKEMON_NFT_ADDRESS and VITE_POKEMON_TRADING_ADDRESS (from <code>npm run deploy</code>).</p>
        <p className="hint">2. Restart the dev server (<code>npm run dev</code>) so it picks up .env, then refresh this page.</p>
        <p className="hint">3. In MetaMask, switch to <strong>Hardhat Local</strong> (Chain ID 31337).</p>
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

      <div className="search-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="All types"
          options={[
            { value: '', label: 'All types' },
            ...TYPES.map((t) => ({ value: t, label: t, color: TYPE_COLORS[t] })),
          ]}
        />
        <FilterSelect
          value={rarityFilter}
          onChange={(v) => setRarityFilter(v)}
          placeholder="All rarities"
          options={[
            { value: '', label: 'All rarities' },
            ...([1, 2, 3, 4, 5].map((r) => ({ value: String(r), label: RARITY_LABELS[r] }))),
          ]}
        />
        <button
          type="button"
          className="btn btn-outline filter-clear"
          onClick={() => { setSearchQuery(''); setTypeFilter(''); setRarityFilter(''); }}
        >
          Clear
        </button>
      </div>

      <section className="section">
        <h3>Fixed Price Listings</h3>
        <div className="card-grid">
          {filteredListings.map((item) => (
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
        {filteredListings.length === 0 && !loading && <p className="empty">{listings.length === 0 ? 'No listings' : 'No matching listings'}</p>}
      </section>

      <section className="section">
        <h3>Auctions</h3>
        <div className="card-grid">
          {filteredAuctions.map((item) => (
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
        {filteredAuctions.length === 0 && !loading && <p className="empty">{auctions.length === 0 ? 'No active auctions' : 'No matching auctions'}</p>}
      </section>

      {account && myCards.length > 0 && (
        <section className="section">
          <h3>My Cards</h3>
          <div className="card-grid">
            {filteredMyCards.map((item) => (
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
          {filteredMyCards.length === 0 && <p className="empty">No matching cards</p>}
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
      <div className="card-tile-image">
        <CardImage tokenURI={item.tokenURI} alt={item.name} />
      </div>
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
