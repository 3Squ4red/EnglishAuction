async function main() {
  const [seller] = await ethers.getSigners(0);

  // Deploying sample NFT
  console.log("Deploying sample NFT...");
  const NFT = await ethers.getContractFactory("MyNFT");
  const nft = await NFT.deploy();
  await nft.deployed();
  console.log(`NFT deployed at ${nft.address}`);

  // Minting an NFT for the seller
  console.log("Minting an NFT for the seller");
  await nft.mint(seller.address, 555);

  // Deploying the EnglishAuction with 10 wei as the starting price
  console.log("Deploying the EnglishAuction...");
  const Auction = await ethers.getContractFactory("EnglishAuction");
  const auction = await Auction.deploy(nft.address, 555, 10);
  await auction.deployed();
  console.log(`EnglishAuction deployed at ${auction.address}`);

  // Approving the auction contract to make NFT transfers
  console.log("Approving the contract to make NFT transfers...");
  await nft.approve(auction.address, 555);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
