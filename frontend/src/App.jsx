import { WalletConnect } from './components/WalletConnect';
import { Marketplace } from './components/Marketplace';
import { MintCard } from './components/MintCard';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>PokeOne</h1>
        <p className="tagline">Decentralized Pokémon Card Trading</p>
        <WalletConnect />
      </header>

      <main className="main">
        <MintCard />
        <Marketplace />
      </main>
    </div>
  );
}

export default App;
