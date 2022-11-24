const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("EnglishAuction", () => {
  const DURATION = 7 * 24 * 60 * 60;
  let seller, accounts, nft, auction;

  beforeEach(async () => {
    [seller, ...accounts] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("MyNFT");
    nft = await NFT.deploy();

    // Minting an NFT of id 555 to the seller
    await nft.mint(seller.address, 555);

    // Checking the owner of 555
    expect(await nft.ownerOf(555)).to.equal(seller.address);

    // Deploying the EnglishAuction with 10 wei as the starting price
    const Auction = await ethers.getContractFactory("EnglishAuction");
    auction = await Auction.deploy(nft.address, 555, 10);

    // Approving the auction contract to make NFT transfers
    await nft.approve(auction.address, 555);
  });

  describe("Placing bids", () => {
    it("Should revert when the seller places a bid", async () => {
      await expect(auction.bid()).to.revertedWithCustomError(
        auction,
        "SellerCannotBid"
      );
    });
    it("should revert while trying to bid after the auction ends", async () => {
      await time.increase(DURATION + 100);
      await expect(auction.connect(accounts[3]).bid())
        .to.revertedWithCustomError(auction, "AuctionTimeEnded")
        .withArgs(await auction.endsAt());
    });
    it("should revert while placing a low/no bid", async () => {
      await expect(auction.connect(accounts[3]).bid())
        .to.revertedWithCustomError(auction, "LowBid")
        .withArgs(await auction.highestBid());
    });
    it("should successfully place a bid", async () => {
      await expect(auction.connect(accounts[1]).bid({ value: 1000 }))
        .to.changeEtherBalances([accounts[1], auction], [-1000, 1000])
        .to.emit(auction, "Bid")
        .withArgs(accounts[1].address, 1000);
      // Checking the state variables
      expect(await auction.highestBidder()).to.equal(accounts[1].address);
      expect(await auction.highestBid()).to.equal(1000);
    });
  });

  describe("Withdrawing", () => {
    it("should revert while withdrawing from an account who is not a bidder", async () => {
      await expect(
        auction.connect(seller).withdraw()
      ).to.revertedWithCustomError(auction, "NotABidder");
    });
    it("should withdraw successfully and emit an event", async () => {
      // Placing a 1000 wei bid first from accounts[1]
      await auction.connect(accounts[1]).bid({ value: 1000 });
      // Placing a 5000 wei bid from accounts[2]
      await auction.connect(accounts[2]).bid({ value: 5000 });
      // Placing a 7000 wei bid again from accounts[1]
      await auction.connect(accounts[1]).bid({ value: 7000 });
      // Placing a 9000 wei bid from accounts[2]
      await auction.connect(accounts[2]).bid({ value: 9000 });
      // Getting the bid of accounts[1]
      const bid = await auction.bids(accounts[1].address); // should be 8000 : 1000+7000
      // Withdrawing 8000 wei from the auction for accounts[1]
      await expect(auction.connect(accounts[1]).withdraw())
        .to.changeEtherBalances([accounts[1], auction], [bid, -bid])
        .to.emit(auction, "Withdraw")
        .withArgs(accounts[1].address, bid);
    });
  });

  describe("Ending the auction", () => {
    it("should revert while ending an already ended auction", async () => {
      await time.increase(DURATION);
      // Ending the auction once
      await auction.end();
      // Should revert while doing it again
      await expect(auction.end())
        .to.revertedWithCustomError(auction, "AlreadyEnded")
        .withArgs(await auction.endsAt());
    });
    it("should revert while trying to end the auction before it's ending time", async () => {
      await expect(auction.end())
        .to.revertedWithCustomError(auction, "EndingTooSoon")
        .withArgs(await auction.endsAt());
    });
    it("should successfully end an auction", async () => {
      // Placing a 1000 wei bid first from accounts[1]
      await auction.connect(accounts[1]).bid({ value: 1000 });
      // Placing a 5000 wei bid from accounts[2]
      await auction.connect(accounts[2]).bid({ value: 5000 });
      // Placing a 7000 wei bid again from accounts[1]
      await auction.connect(accounts[1]).bid({ value: 7000 });
      // Placing a 9000 wei bid from accounts[5]
      await auction.connect(accounts[5]).bid({ value: 9000 });

      // Increasing the time
      await time.increase(DURATION + 100);

      // Getting the highest bid and bidder
      const highestBid = await auction.highestBid();
      const highestBidder = await auction.highestBidder();
      // Ending the auction
      await expect(auction.connect(accounts[11]).end())
        .to.changeEtherBalances([seller, auction], [highestBid, -highestBid])
        .to.emit(auction, "End")
        .withArgs(highestBidder, highestBid);

      // Check the auction status
      expect(await auction.status()).to.equal(1);
      // Check the owner of the NFT
      expect(await nft.ownerOf(555)).to.equal(highestBidder);
    });
  });
});

/**
 * Placing bids
 * Should revert when the seller places a bid
 * Should revert while trying to bid after the auction ends
 * Should revert while placing a low bid
 * Should successfully place a bid - check the highest bidder and the highest bid - should also emit an event
 * Withdrawing
 * Should revert while withdrawing from an account who is not a bidder
 * Should withdraw successfully - should emit an event
 * Ending the auction
 * Should revert while ending an already ended auction
 * Should revert while trying to end the auction before it's ending time
 * Should successfully end an auction - should emit an event - status should be 1 (ENDED) - nft owner should be the highest bidder
 */
