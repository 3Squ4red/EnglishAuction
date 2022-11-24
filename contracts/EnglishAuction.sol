// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IERC721 {
    function safeTransferFrom(
        address from,
        address to,
        uint tokenId
    ) external;

    function transferFrom(
        address,
        address,
        uint
    ) external;
}

contract EnglishAuction {
    enum Status {STARTED, ENDED}

    event Bid(address indexed bidder, uint bid);
    event Withdraw(address indexed bidder, uint bid);
    event End(address winner, uint amount);

    // The auction will not end before this time period
    // unlike Dutch Auction which ends as soon as someone buys the item
    uint private constant DURATION = 7 days;

    IERC721 public immutable nft;
    uint public immutable nftId;

    address payable public immutable seller;
    uint public immutable endsAt;
    Status public status; // by default the status will be STARTED

    address public highestBidder;
    uint public highestBid;
    mapping(address => uint) public bids;

    constructor(
        address _nft,
        uint _nftId,
        uint _startingBid
    ) {
        nft = IERC721(_nft);
        nftId = _nftId;

        seller = payable(msg.sender);
        endsAt = block.timestamp + DURATION;
        highestBid = _startingBid;

        status = Status.STARTED;
    }

    error SellerCannotBid();
    error AuctionTimeEnded(uint endedAt);
    error LowBid(uint highestBid);

    function bid() external payable {
        if(msg.sender == seller) revert SellerCannotBid();
        if(block.timestamp > endsAt) revert AuctionTimeEnded(endsAt);
        if(msg.value < highestBid) revert LowBid(highestBid);

        // At first the highestBidder will be address zero
        if (highestBidder != address(0)) {
            // Saving the last highest bid in the mapping
            // so that it's bidder could withdraw it later
            bids[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        emit Bid(msg.sender, msg.value);
    }

    error NotABidder();

    // At any point in time, any bidder can withdraw their bids 
    // which were surpassed by other higher bids
    function withdraw() external {
        uint bal = bids[msg.sender];

        if(bal == 0) revert NotABidder();

        // Point of possible reentrancy if the amount is sent before
        // updating the bid
        bids[msg.sender] = 0;
        payable(msg.sender).transfer(bal);

        emit Withdraw(msg.sender, bal);
    }

    error AlreadyEnded(uint endedAt);
    error EndingTooSoon(uint endingTime);

    // Letting anyone AND NOT just the seller to end the Auction after the auction duration ends so that the seller won't misuse his powers by never calling this function or he may simply forget to call this function, halting the auction
    function end() external {
        if(status == Status.ENDED) revert AlreadyEnded(endsAt);
        if(block.timestamp < endsAt) revert EndingTooSoon(endsAt);

        // Update the status
        status = Status.ENDED;

        // highestBidder will be the 0 address when no one places any bid
        // in the whole duration of the auction
        if (highestBidder != address(0)) {
            nft.safeTransferFrom(seller, highestBidder, nftId);
            seller.transfer(highestBid);
        }

        emit End(highestBidder, highestBid);
    }
}
