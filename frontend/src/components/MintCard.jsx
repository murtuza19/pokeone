import { useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';

export function MintCard() {
  const { pokemonNFT, account, isCorrectNetwork } = useWeb3();
  const [name, setName] = useState('Pikachu');
  const [pokemonType, setPokemonType] = useState('Electric');
  const [hp, setHp] = useState(35);
  const [attack, setAttack] = useState(55);
  const [defense, setDefense] = useState(40);
  const [rarity, setRarity] = useState(3);
  const [uri, setUri] = useState('ipfs://placeholder');
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState('');

  const canMint = pokemonNFT && account && isCorrectNetwork;
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
        hp,
        attack,
        defense,
        rarity
      );
      await tx.wait();
      setName('Pikachu');
      setPokemonType('Electric');
      setHp(35);
      setAttack(55);
      setDefense(40);
      setRarity(3);
      setUri('ipfs://placeholder');
    } catch (err) {
      setError(err.shortMessage || err.message || 'Mint failed');
    } finally {
      setTxPending(false);
    }
  };

  return (
    <div className="mint-card">
      <h3>Mint Pokemon Card</h3>
      <p className="hint">Owner only - for demo</p>
      <div className="mint-form">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Type
          <select value={pokemonType} onChange={(e) => setPokemonType(e.target.value)}>
            <option>Fire</option>
            <option>Water</option>
            <option>Electric</option>
            <option>Grass</option>
            <option>Psychic</option>
            <option>Fighting</option>
          </select>
        </label>
        <label>
          HP <input type="number" min="1" max="255" value={hp} onChange={(e) => setHp(Number(e.target.value))} />
        </label>
        <label>
          Attack <input type="number" min="1" max="255" value={attack} onChange={(e) => setAttack(Number(e.target.value))} />
        </label>
        <label>
          Defense <input type="number" min="1" max="255" value={defense} onChange={(e) => setDefense(Number(e.target.value))} />
        </label>
        <label>
          Rarity (1-5)
          <input type="number" min="1" max="5" value={rarity} onChange={(e) => setRarity(Number(e.target.value))} />
        </label>
        <label>
          Token URI
          <input value={uri} onChange={(e) => setUri(e.target.value)} />
        </label>
        {!account && <p className="hint">Connect your wallet first.</p>}
        {account && !isCorrectNetwork && <p className="error">Switch to Hardhat Local (Chain ID 31337) to mint.</p>}
        {account && isCorrectNetwork && !pokemonNFT && <p className="error">Contracts not loaded. Restart dev server and refresh the page.</p>}
        {error && <p className="error">{error}</p>}
        <button onClick={handleMint} disabled={txPending || !canMint} className="btn btn-primary">
          {txPending ? 'Minting...' : canMint ? 'Mint' : 'Mint (connect wallet & use Hardhat Local)'}
        </button>
      </div>
    </div>
  );
}
