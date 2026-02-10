/**
 * Contract addresses - update after running: npm run deploy
 * Get addresses from deployment output when running against localhost
 */
export const CONFIG = {
  // Hardhat localhost chainId
  chainId: 31337,
  // Update these after deployment
  pokemonNFTAddress: import.meta.env.VITE_POKEMON_NFT_ADDRESS || '',
  pokemonTradingAddress: import.meta.env.VITE_POKEMON_TRADING_ADDRESS || '',
};
