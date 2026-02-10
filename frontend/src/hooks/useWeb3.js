import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import PokemonNFTArtifact from '../../../artifacts/contracts/PokemonNFT.sol/PokemonNFT.json';
import PokemonTradingArtifact from '../../../artifacts/contracts/PokemonTrading.sol/PokemonTrading.json';
import { CONFIG } from '../config';

export function useWeb3() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [pokemonNFT, setPokemonNFT] = useState(null);
  const [pokemonTrading, setPokemonTrading] = useState(null);

  const connect = useCallback(async () => {
    setError(null);
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
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setPokemonNFT(null);
    setPokemonTrading(null);
  }, []);

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

  return {
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
  };
}
