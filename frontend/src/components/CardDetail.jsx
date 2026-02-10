import { useState } from 'react';
import { formatEther, parseEther } from 'ethers';

export function CardDetail({ card, onClose, onUpdate, pokemonNFT, pokemonTrading, account, getTypeColor, RARITY_LABELS }) {
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ '--type-color': getTypeColor(card.pokemonType) }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3>{card.name}</h3>
        <div className="modal-stats">
          <span className="type-badge">{card.pokemonType}</span>
          <span>{RARITY_LABELS[card.rarity]}</span>
          <span>HP {card.hp} | ATK {card.attack} | DEF {card.defense}</span>
        </div>
        {error && <p className="error">{error}</p>}
        {card.mode === 'listing' && (
          <div className="modal-actions">
            <p className="price">{formatEther(card.price)} ETH</p>
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
            <p>Highest bid: {card.highestBid ? formatEther(card.highestBid) : '0'} ETH</p>
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
