import { useWeb3 } from '../hooks/useWeb3';

export function WalletConnect() {
  const { account, connect, disconnect, error, chainId, isCorrectNetwork } = useWeb3();

  const shortenAddress = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  return (
    <div className="wallet-connect">
      {error && <p className="error">{error}</p>}
      {account ? (
        <div className="wallet-info">
          {!isCorrectNetwork && chainId && (
            <span className="network-warn">Wrong network (Chain ID: {chainId})</span>
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
