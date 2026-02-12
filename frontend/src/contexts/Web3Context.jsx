import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import PokemonNFTArtifact from '../../../artifacts/contracts/PokemonNFT.sol/PokemonNFT.json';
import PokemonTradingArtifact from '../../../artifacts/contracts/PokemonTrading.sol/PokemonTrading.json';
import { CONFIG } from '../config';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [pokemonNFT, setPokemonNFT] = useState(null);
  const [pokemonTrading, setPokemonTrading] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      if (!window.ethereum) {
        throw new Error('Please install MetaMask');
      }
      const prov = new BrowserProvider(window.ethereum);
      const accounts = await prov.send('eth_requestAccounts', []);
      const sig = await prov.getSigner();
      const network = await prov.getNetwork();

      setProvider(prov);
      setSigner(sig);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));

      if (CONFIG.pokemonNFTAddress && CONFIG.pokemonTradingAddress) {
        setPokemonNFT(
          new Contract(CONFIG.pokemonNFTAddress, PokemonNFTArtifact.abi, sig)
        );
        setPokemonTrading(
          new Contract(CONFIG.pokemonTradingAddress, PokemonTradingArtifact.abi, sig)
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to connect');
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setPokemonNFT(null);
    setPokemonTrading(null);
    setIsOwner(false);
  }, []);

  useEffect(() => {
    if (!pokemonNFT || !account) {
      setIsOwner(false);
      return;
    }
    pokemonNFT.owner()
      .then((owner) => setIsOwner(owner?.toLowerCase() === account.toLowerCase()))
      .catch(() => setIsOwner(false));
  }, [pokemonNFT, account]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect();
      else setAccount(accounts[0]);
    };
    const handleChainChanged = () => window.location.reload();
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect]);

  const value = {
    account,
    provider,
    signer,
    chainId,
    pokemonNFT,
    pokemonTrading,
    error,
    connect,
    disconnect,
    isCorrectNetwork: chainId === CONFIG.chainId,
    isOwner,
    isConnecting,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
}
