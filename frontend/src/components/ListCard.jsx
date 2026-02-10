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

import { parseEther } from 'ethers';

export function ListCard({ myCards, onClose, onListed, pokemonNFT, pokemonTrading }) {
  useLockBodyScroll(true);
  const [selectedId, setSelectedId] = useState(null);
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState('fixed'); // 'fixed' | 'auction'
  const [auctionPrice, setAuctionPrice] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('60'); // minutes
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState('');

  const handleList = async () => {
    if (!pokemonTrading || !pokemonNFT || selectedId == null) return;
    setError('');
    setTxPending(true);
    try {
      await pokemonNFT.approve(await pokemonTrading.getAddress(), selectedId);
      if (mode === 'fixed') {
        const tx = await pokemonTrading.listCard(selectedId, parseEther(price));
        await tx.wait();
      } else {
        const tx = await pokemonTrading.startAuction(
          selectedId,
          parseEther(auctionPrice),
          parseInt(auctionDuration) * 60
        );
        await tx.wait();
      }
      onListed();
      onClose();
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed');
    } finally {
      setTxPending(false);
    }
  };

  const canSubmit =
    mode === 'fixed'
      ? price && parseFloat(price) > 0
      : auctionPrice && parseFloat(auctionPrice) > 0 && parseInt(auctionDuration) >= 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3>List a Card</h3>
        {myCards.length === 0 ? (
          <p>You have no cards to list.</p>
        ) : (
          <>
            <div className="list-mode">
              <label>
                <input
                  type="radio"
                  checked={mode === 'fixed'}
                  onChange={() => setMode('fixed')}
                />
                Fixed Price
              </label>
              <label>
                <input
                  type="radio"
                  checked={mode === 'auction'}
                  onChange={() => setMode('auction')}
                />
                Auction
              </label>
            </div>
            <div className="card-select">
              {myCards.map((c) => (
                <button
                  key={c.tokenId}
                  className={`card-option ${selectedId === c.tokenId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(c.tokenId)}
                >
                  #{Number(c.tokenId) + 1} {c.name}
                </button>
              ))}
            </div>
            {selectedId != null && (
              <div className="list-form">
                {mode === 'fixed' && (
                  <label>
                    Price (ETH)
                    <input
                      type="text"
                      placeholder="0.1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </label>
                )}
                {mode === 'auction' && (
                  <>
                    <label>
                      Starting Price (ETH)
                      <input
                        type="text"
                        placeholder="0.1"
                        value={auctionPrice}
                        onChange={(e) => setAuctionPrice(e.target.value)}
                      />
                    </label>
                    <label>
                      Duration (minutes)
                      <input
                        type="number"
                        min="1"
                        value={auctionDuration}
                        onChange={(e) => setAuctionDuration(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>
            )}
            {error && <p className="error">{error}</p>}
            <button
              onClick={handleList}
              disabled={txPending || !canSubmit}
              className="btn btn-primary"
            >
              {txPending ? 'Confirming...' : 'List Card'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
