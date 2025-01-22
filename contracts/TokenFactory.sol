// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Token.sol";
import "./QiteSwap.sol";
import "./QitePool.sol";

contract TokenFactory {
    address public owner;

    constructor() {
        owner = msg.sender; // Set the deployer as the owner
    }

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

    uint constant MEMETOKEN_CREATION_PLATFORM_FEE = 0.0001 ether;
    uint constant MEMECOIN_FUNDING_GOAL = 10 ether;

    uint constant DECIMALS = 10 ** 18;
    uint constant MAX_SUPPLY = 1000000000 * DECIMALS;
    uint constant SELL_SUPPLY = 600000000 * DECIMALS;
    uint constant INIT_SUPPLY = (20 * MAX_SUPPLY) / 100;

    uint256 public constant INITIAL_PRICE = 25000000000; // Initial price in wei
    uint256 public constant K = 8 * 10 ** 15; // Growth rate

    event MemeTokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol
    );

    event MemeTokenPurchased(
        address indexed buyer,
        address indexed tokenAddress,
        uint256 quantity,
        uint256 cost
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function calculateCost(
        uint256 currentSupply,
        uint256 tokensToBuy
    ) public pure returns (uint256) {
        uint256 newSupply = currentSupply + tokensToBuy;

        uint256 exp1 = exp((K * newSupply) / DECIMALS);
        uint256 exp2 = exp((K * currentSupply) / DECIMALS);

        uint256 difference = exp1 > exp2 ? exp1 - exp2 : exp2 - exp1;

        return
            difference < 10 ** 12
                ? INITIAL_PRICE
                : (INITIAL_PRICE * difference) / DECIMALS;
    }

    function exp(uint256 x) internal pure returns (uint256) {
        if (x > 10 ** 20) return 10 ** 18; // Avoid overflow for large x

        uint256 sum = 10 ** 18;
        uint256 term = 10 ** 18;

        for (uint256 i = 1; i <= 20; i++) {
            term = (term * x) / (i * 10 ** 18);
            sum += term;

            if (term < 1) break; // Stop when terms are negligible
        }

        return sum;
    }

    function createMemeToken(
        string memory name,
        string memory symbol,
        string memory imageUrl,
        string memory description
    ) public payable returns (address) {
        require(msg.value >= MEMETOKEN_CREATION_PLATFORM_FEE, "Fee not paid");

        Token token = new Token(name, symbol, INIT_SUPPLY);
        address tokenAddress = address(token);

        MemeToken memory newToken = MemeToken(
            name,
            symbol,
            description,
            imageUrl,
            0,
            tokenAddress,
            msg.sender
        );

        memeTokenAddresses.push(tokenAddress);
        addressToMemeTokenMapping[tokenAddress] = newToken;

        emit MemeTokenCreated(tokenAddress, msg.sender, name, symbol);

        return tokenAddress;
    }

    function buyMemeToken(
        address memeTokenAddress,
        uint256 tokenQty
    ) public payable {
        require(
            addressToMemeTokenMapping[memeTokenAddress].tokenAddress !=
                address(0),
            "Token is not listed"
        );

        MemeToken storage listedToken = addressToMemeTokenMapping[
            memeTokenAddress
        ];
        Token memeToken = Token(memeTokenAddress);

        uint256 currentSupply = memeToken.totalSupply();
        uint256 availableQty = SELL_SUPPLY - currentSupply;

        uint256 tokenQtyScaled = tokenQty * DECIMALS;
        require(tokenQtyScaled <= availableQty, "Not enough tokens available");

        uint256 requiredEth = calculateCost(
            (currentSupply - INIT_SUPPLY) / DECIMALS,
            tokenQty
        );
        require(msg.value >= requiredEth, "Insufficient ETH sent");

        listedToken.fundingRaised += requiredEth;
        memeToken.mint(tokenQtyScaled, msg.sender);

        emit MemeTokenPurchased(
            msg.sender,
            memeTokenAddress,
            tokenQty,
            requiredEth
        );

        uint256 excessEth = msg.value - requiredEth;
        if (excessEth > 0) {
            payable(msg.sender).transfer(excessEth);
        }
    }

    function sellMemeToken(address memeTokenAddress, uint256 tokenQty) public {
        require(
            addressToMemeTokenMapping[memeTokenAddress].tokenAddress !=
                address(0),
            "Token is not listed"
        );

        MemeToken storage listedToken = addressToMemeTokenMapping[
            memeTokenAddress
        ];
        Token memeToken = Token(memeTokenAddress);

        uint256 tokenQtyScaled = tokenQty * DECIMALS;

        require(
            memeToken.balanceOf(msg.sender) >= tokenQtyScaled,
            "Insufficient token balance"
        );

        uint256 sellPrice = calculateCost(
            (memeToken.totalSupply() - INIT_SUPPLY) / DECIMALS,
            tokenQty
        );

        require(
            address(this).balance >= sellPrice,
            "Contract does not have enough ETH"
        );

        // Burn the tokens from the seller
        memeToken.burn(msg.sender, tokenQtyScaled); // Adjusted order of arguments

        // Update funding raised
        listedToken.fundingRaised -= sellPrice;

        // Transfer ETH to the seller
        payable(msg.sender).transfer(sellPrice);

        emit MemeTokenPurchased(
            msg.sender,
            memeTokenAddress,
            tokenQty,
            sellPrice
        );
    }

    function getAllMemeTokens() public view returns (MemeToken[] memory) {
        uint256 length = memeTokenAddresses.length;
        MemeToken[] memory allTokens = new MemeToken[](length);
        for (uint256 i = 0; i < length; i++) {
            allTokens[i] = addressToMemeTokenMapping[memeTokenAddresses[i]];
        }
        return allTokens;
    }
}
