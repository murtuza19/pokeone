import { useState, useEffect } from 'react';

function useLockBodyScroll(locked) {
  useEffect(() => {
    if (locked) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [locked]);
}
import { formatEther, parseEther } from 'ethers';

function shortenAddress(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
}

const DEFAULT_CARD_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'%3E%3Crect fill='%230f3460' rx='12' width='200' height='280'/%3E%3Crect fill='%231a4a7a' rx='8' x='16' y='16' width='168' height='168'/%3E%3Ctext x='100' y='115' fill='%23ffcb05' text-anchor='middle' font-family='sans-serif' font-size='48' font-weight='bold'%3EPKMN%3C/text%3E%3Ctext x='100' y='260' fill='%23a0aec0' text-anchor='middle' font-family='sans-serif' font-size='14'%3EPokeOne%3C/text%3E%3C/svg%3E";

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
    fetch(s)
      .then((r) => r.json())
      .then((j) => setUrl(j.image || DEFAULT_CARD_IMAGE))
      .catch(() => setUrl(s));
  }, [tokenURI]);
  const displayUrl = failed || !url ? DEFAULT_CARD_IMAGE : url;
  return <img src={displayUrl} alt={alt || 'Pokemon card'} className="modal-card-image" onError={() => setFailed(true)} />;
}

export function CardDetail({ card, onClose, onUpdate, pokemonNFT, pokemonTrading, account, getTypeColor, RARITY_LABELS }) {
  useLockBodyScroll(true);
  const [amount, setAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState('');

  const handleBuy = async () => {
    if (!pokemonTrading || !card.price) return;
    setError('');
    setTxPending(true);
    try {
      const tx = await pokemonTrading.buyCard(card.tokenId, { value: card.price });
      await tx.wait();
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed');
    } finally {
      setTxPending(false);
    }
  };

  const handleBid = async () => {
    if (!pokemonTrading || !amount) return;
    setError('');
    setTxPending(true);
    try {
      const tx = await pokemonTrading.placeBid(card.tokenId, { value: parseEther(amount) });
      await tx.wait();
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed');
    } finally {
      setTxPending(false);
    }
  };

  const handleSettle = async () => {
    if (!pokemonTrading) return;
    setError('');
    setTxPending(true);
    try {
      const tx = await pokemonTrading.settleAuction(card.tokenId);
      await tx.wait();
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed');
    } finally {
      setTxPending(false);
    }
  };

  const handleUnlist = async () => {
    if (!pokemonTrading) return;
    setError('');
    setTxPending(true);
    try {
      const tx = await pokemonTrading.unlistCard(card.tokenId);
      await tx.wait();
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed');
    } finally {
      setTxPending(false);
    }
  };

  const isSeller = account && card.seller?.toLowerCase() === account.toLowerCase();
  const endTime = card.endTime ? Number(card.endTime) : 0;
  const isEnded = endTime > 0 && Date.now() / 1000 >= endTime;
  const timeRemaining = !isEnded && endTime > 0
    ? Math.max(0, Math.floor(endTime - Date.now() / 1000))
    : 0;
  const highestEth = card.highestBid ? Number(card.highestBid) / 1e18 : 0;
  const startingEth = card.startingPrice ? Number(card.startingPrice) / 1e18 : 0;
  const minNextBid = card.highestBidder ? highestEth * 1.05 : (startingEth || highestEth);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-card-detail" onClick={(e) => e.stopPropagation()} style={{ '--type-color': getTypeColor(card.pokemonType) }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-card-header">
          <h3>{card.name}</h3>
          <span className="modal-token-id">#{Number(card.tokenId) + 1}</span>
        </div>

        <div className="modal-card-image-wrap">
          <CardImage tokenURI={card.tokenURI} alt={card.name} />
        </div>

        <div className="modal-badges">
          <span className="type-badge">{card.pokemonType}</span>
          <span className="rarity-badge">{RARITY_LABELS[card.rarity]}</span>
        </div>

        <div className="modal-stats-grid">
          <div className="stat-box">
            <span className="stat-label">HP</span>
            <span className="stat-value">{Number(card.hp ?? 0)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">ATK</span>
            <span className="stat-value">{Number(card.attack ?? 0)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">DEF</span>
            <span className="stat-value">{Number(card.defense ?? 0)}</span>
          </div>
        </div>

        {card.seller && (
          <p className="modal-seller">
            Listed by <strong>{shortenAddress(card.seller)}</strong>
            {isSeller && <span className="you-badge"> (You)</span>}
          </p>
        )}

        {error && <p className="error">{error}</p>}

        {card.mode === 'listing' && (
          <div className="modal-actions">
            <div className="modal-price-row">
              <span className="price-label">Price</span>
              <span className="price">{formatEther(card.price)} ETH</span>
            </div>
            {!isSeller && account && (
              <button onClick={handleBuy} disabled={txPending} className="btn btn-primary">
                {txPending ? 'Confirming...' : 'Buy Now'}
              </button>
            )}
            {isSeller && (
              <button onClick={handleUnlist} disabled={txPending} className="btn btn-outline">
                {txPending ? 'Confirming...' : 'Unlist'}
              </button>
            )}
          </div>
        )}

        {card.mode === 'auction' && (
          <div className="modal-actions">
            <div className="modal-auction-info">
              <div className="modal-price-row">
                <span className="price-label">Highest bid</span>
                <span className="price">{card.highestBid ? formatEther(card.highestBid) : '0'} ETH</span>
              </div>
              {!isEnded && (
                <>
                  <div className="modal-price-row">
                    <span className="price-label">Min. next bid</span>
                    <span className="price">{minNextBid.toFixed(4)} ETH</span>
                  </div>
                  <div className="modal-price-row">
                    <span className="price-label">Time left</span>
                    <span className="price">{formatTime(timeRemaining)}</span>
                  </div>
                </>
              )}
            </div>
            {isEnded ? (
              <button onClick={handleSettle} disabled={txPending} className="btn btn-primary">
                {txPending ? 'Confirming...' : 'Settle Auction'}
              </button>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Bid amount (ETH)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <button onClick={handleBid} disabled={txPending || !amount} className="btn btn-primary">
                  {txPending ? 'Confirming...' : 'Place Bid'}
                </button>
              </>
            )}
          </div>
        )}

        {card.mode === 'mine' && (
          <p className="hint">Select &quot;List a Card&quot; to sell this card.</p>
        )}
      </div>
    </div>
  );
}
