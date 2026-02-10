import { useWeb3 } from '../hooks/useWeb3';
import { CONFIG } from '../config';

export function WalletConnect() {
  const { account, connect, disconnect, error, chainId, isCorrectNetwork } = useWeb3();

  const shortenAddress = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const switchToHardhat = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CONFIG.chainId.toString(16)}` }],
      });
      window.location.reload();
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${CONFIG.chainId.toString(16)}`,
            chainName: 'Hardhat Local',
            rpcUrls: ['http://127.0.0.1:8545'],
          }],
        });
        window.location.reload();
      }
    }
  };

  return (
    <div className="wallet-connect">
      {error && <p className="error">{error}</p>}
      {account ? (
        <div className="wallet-info">
          {!isCorrectNetwork && chainId && (
            <>
              <span className="network-warn">Wrong network (Chain ID: {chainId})</span>
              <button onClick={switchToHardhat} className="btn btn-primary" type="button">
                Switch to Hardhat Local
              </button>
            </>
          )}
          <span className="address">{shortenAddress(account)}</span>
          <button onClick={disconnect} className="btn btn-outline">
            Disconnect
          </button>
        </div>
      ) : (
        <button onClick={connect} className="btn btn-primary">
          Connect Wallet
        </button>
      )}
    </div>
  );
}
