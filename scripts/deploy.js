const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const PokemonNFT = await hre.ethers.getContractFactory("PokemonNFT");
  const pokemonNFT = await PokemonNFT.deploy();
  await pokemonNFT.waitForDeployment();
  const nftAddress = await pokemonNFT.getAddress();
  console.log("PokemonNFT deployed to:", nftAddress);

  const PokemonTrading = await hre.ethers.getContractFactory("PokemonTrading");
  const pokemonTrading = await PokemonTrading.deploy(nftAddress);
  await pokemonTrading.waitForDeployment();
  const tradingAddress = await pokemonTrading.getAddress();
  console.log("PokemonTrading deployed to:", tradingAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("PokemonNFT:", nftAddress);
  console.log("PokemonTrading:", tradingAddress);
  console.log("\nFor frontend, create frontend/.env with:");
  console.log("VITE_POKEMON_NFT_ADDRESS=" + nftAddress);
  console.log("VITE_POKEMON_TRADING_ADDRESS=" + tradingAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
