const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const nftAddress = process.env.POKEMON_NFT_ADDRESS;
  if (!nftAddress) {
    console.log("Set POKEMON_NFT_ADDRESS and run again, or run: npm run deploy");
    return;
  }

  const PokemonNFT = await hre.ethers.getContractFactory("PokemonNFT");
  const nft = PokemonNFT.attach(nftAddress);

  const cards = [
    { name: "Pikachu", type: "Electric", hp: 35, atk: 55, def: 40, rarity: 3 },
    { name: "Charizard", type: "Fire", hp: 78, atk: 84, def: 78, rarity: 5 },
    { name: "Blastoise", type: "Water", hp: 79, atk: 83, def: 100, rarity: 5 },
    { name: "Bulbasaur", type: "Grass", hp: 45, atk: 49, def: 49, rarity: 2 },
    { name: "Mewtwo", type: "Psychic", hp: 106, atk: 110, def: 90, rarity: 5 },
  ];

  for (const c of cards) {
    const tx = await nft.mint(
      deployer.address,
      `ipfs://${c.name.toLowerCase()}`,
      c.name,
      c.type,
      c.hp,
      c.atk,
      c.def,
      c.rarity
    );
    await tx.wait();
    console.log(`Minted ${c.name}`);
  }
  console.log("Seed complete.");
}

main().catch(console.error);
