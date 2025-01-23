// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Token.sol";

contract TokenFactory {
    address public owner;

    uint256 public totalSupply; // Total tokens minted
    uint256 public constant INITIAL_PRICE_WEI = 100100000; // 100,100,000 WEI
    uint256 public constant INCREMENT_WEI = 100000; // Increment per token in WEI
    uint256 public constant MAX_SUPPLY = 1000000000; // Maximum supply of tokens
    uint256 public constant CURVE_CAP = 700000000; // Bonding curve stops at 700 million tokens
    uint256 public constant TAX_PERCENTAGE = 1; // 1% tax on buy and sell
    uint256 public constant TOKEN_CREATION_FEE = 0.01 ether; // Fee for creating a token

    mapping(address => uint256) public balances;

    struct MemeToken {
        string name;
        string symbol;
        string description;
        string tokenImageUrl;
        uint fundingRaised;
        address tokenAddress;
        address creatorAddress;
    }

    address[] public memeTokenAddresses;
    mapping(address => MemeToken) public addressToMemeTokenMapping;

    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 cost,
        uint256 tax
    );
    event TokensSold(
        address indexed seller,
        uint256 amount,
        uint256 revenue,
        uint256 tax
    );
    event TokenCreated(
        address indexed creator,
        address tokenAddress,
        string name,
        string symbol
    );

    constructor() {
        owner = msg.sender;
        totalSupply = 0; // No tokens sold initially
        balances[owner] = MAX_SUPPLY; // Allocate all tokens to the owner
    }

    function calculateCost(uint256 amount) public view returns (uint256) {
        require(amount > 0, "Amount must be greater than zero");
        require(
            totalSupply + amount <= CURVE_CAP,
            "Bonding curve limit reached"
        );

        uint256 startPrice = INITIAL_PRICE_WEI + (totalSupply * INCREMENT_WEI);
        uint256 endPrice = startPrice + ((amount - 1) * INCREMENT_WEI);

        // Arithmetic progression sum formula
        return (amount * (startPrice + endPrice)) / 2;
    }

    function calculateRevenue(uint256 amount) public view returns (uint256) {
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= totalSupply, "Amount exceeds available supply");

        uint256 endPrice = INITIAL_PRICE_WEI +
            ((totalSupply - 1) * INCREMENT_WEI);
        uint256 startPrice;

        unchecked {
            startPrice = endPrice - ((amount - 1) * INCREMENT_WEI);
        }

        // Arithmetic progression sum formula
        return (amount * (startPrice + endPrice)) / 2;
    }

    function buyTokens(uint256 amount) external payable {
        require(
            balances[owner] >= amount,
            "Not enough tokens available for purchase"
        );

        uint256 cost = calculateCost(amount);
        uint256 tax = (cost * TAX_PERCENTAGE) / 100;
        uint256 totalCost = cost + tax;

        require(msg.value >= totalCost, "Insufficient Ether sent");

        // Transfer tokens from the owner to the buyer
        balances[owner] -= amount;
        balances[msg.sender] += amount;

        // Increment totalSupply after successful purchase
        totalSupply += amount;

        // Transfer the tax to the deployer (owner)
        payable(owner).transfer(tax);

        // Refund excess Ether if sent
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit TokensPurchased(msg.sender, amount, cost, tax);
    }

    function sellTokens(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient token balance");

        uint256 revenue = calculateRevenue(amount);
        uint256 tax = (revenue * TAX_PERCENTAGE) / 100;
        uint256 netRevenue = revenue - tax;

        // Transfer tokens from the seller to the owner
        balances[msg.sender] -= amount;
        balances[owner] += amount;

        // Decrement totalSupply after tokens are sold
        totalSupply -= amount;

        // Transfer the net revenue to the seller
        payable(msg.sender).transfer(netRevenue);

        // Transfer the tax to the deployer (owner)
        payable(owner).transfer(tax);

        emit TokensSold(msg.sender, amount, revenue, tax);
    }

    function createMemeToken(
        string memory name,
        string memory symbol,
        string memory imageUrl,
        string memory description
    ) public payable returns (address) {
        require(msg.value >= TOKEN_CREATION_FEE, "Insufficient creation fee");
        require(bytes(name).length > 0, "Invalid token name");
        require(bytes(symbol).length > 0, "Invalid token symbol");

        // Transfer the token creation fee to the deployer (owner)
        payable(owner).transfer(msg.value);

        // Create the new token
        Token ct = new Token(name, symbol, 0); // Initial supply set to 0
        address memeTokenAddress = address(ct);
        MemeToken memory newlyCreatedToken = MemeToken(
            name,
            symbol,
            description,
            imageUrl,
            0,
            memeTokenAddress,
            msg.sender
        );
        memeTokenAddresses.push(memeTokenAddress);
        addressToMemeTokenMapping[memeTokenAddress] = newlyCreatedToken;

        emit TokenCreated(msg.sender, memeTokenAddress, name, symbol);
        return memeTokenAddress;
    }

    function getAllMemeTokens() public view returns (MemeToken[] memory) {
        MemeToken[] memory allTokens = new MemeToken[](
            memeTokenAddresses.length
        );
        for (uint i = 0; i < memeTokenAddresses.length; i++) {
            allTokens[i] = addressToMemeTokenMapping[memeTokenAddresses[i]];
        }
        return allTokens;
    }

    receive() external payable {}

    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }
}
