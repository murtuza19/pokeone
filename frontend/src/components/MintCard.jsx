import { useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { TypeSelect } from './TypeSelect';

export function MintCard() {
  const { pokemonNFT, account, isCorrectNetwork, isOwner } = useWeb3();
  const [name, setName] = useState('');
  const [pokemonType, setPokemonType] = useState('');
  const [hp, setHp] = useState('');
  const [attack, setAttack] = useState('');
  const [defense, setDefense] = useState('');
  const [rarity, setRarity] = useState('');
  const [uri, setUri] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState('');

  const hpNum = Math.min(255, Math.max(0, parseInt(hp, 10) || 0));
  const attackNum = Math.min(255, Math.max(0, parseInt(attack, 10) || 0));
  const defenseNum = Math.min(255, Math.max(0, parseInt(defense, 10) || 0));
  const rarityNum = Math.min(5, Math.max(1, parseInt(rarity, 10) || 1));
  const canMint = Boolean(pokemonNFT && account && isCorrectNetwork && isOwner && name.trim());
  const handleMint = async () => {
    if (!canMint) return;
    setError('');
    setTxPending(true);
    try {
      const tx = await pokemonNFT.mint(
        account,
        uri,
        name,
        pokemonType,
        hpNum,
        attackNum,
        defenseNum,
        rarityNum
      );
      await tx.wait();
      setName('');
      setPokemonType('');
      setHp('');
      setAttack('');
      setDefense('');
      setRarity('');
      setUri('');
    } catch (err) {
      const msg = err.shortMessage ?? err.message ?? (typeof err === 'string' ? err : 'Mint failed');
      setError(msg);
      console.error('Mint error:', err);
    } finally {
      setTxPending(false);
    }
  };

  if (!isOwner) return null;

  return (
    <div className="mint-card">
      <h3>Mint Pokemon Card</h3>
      <p className="hint">Owner only - for demo. HP, Attack, Defense: 0–255. Rarity: 1–5.</p>
      <div className="mint-form">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Type
          <TypeSelect value={pokemonType} onChange={setPokemonType} />
        </label>
        <label>
          HP <input type="number" min="0" max="255" placeholder="0" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
        <label>
          Attack <input type="number" min="0" max="255" placeholder="0" value={attack} onChange={(e) => setAttack(e.target.value)} />
        </label>
        <label>
          Defense <input type="number" min="0" max="255" placeholder="0" value={defense} onChange={(e) => setDefense(e.target.value)} />
        </label>
        <label>
          Rarity (1-5)
          <input type="number" min="1" max="5" placeholder="1" value={rarity} onChange={(e) => setRarity(e.target.value)} />
        </label>
        <label>
          Image URL
          <input value={uri} onChange={(e) => setUri(e.target.value)} />
        </label>
        {!account && <p className="hint">Connect your wallet first.</p>}
        {account && !isCorrectNetwork && <p className="error">Switch to Hardhat Local (Chain ID 31337) to mint.</p>}
        {account && isCorrectNetwork && !pokemonNFT && <p className="error">Contracts not loaded. Restart dev server and refresh the page.</p>}
        {account && isCorrectNetwork && pokemonNFT && !name.trim() && <p className="hint">Enter a card name to enable minting.</p>}
        {error && <p className="error">{error}</p>}
        <button onClick={handleMint} disabled={txPending || !canMint} className="btn btn-primary">
          {txPending ? 'Minting...' : canMint ? 'Mint' : 'Mint'}
        </button>
      </div>
    </div>
  );
}
