// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Token.sol";
import "./QiteSwap.sol";
import "./QitePool.sol";
import "hardhat/console.sol";

contract TokenFactory {
    address public owner;

    constructor() {
        owner = msg.sender; // Set the contract deployer as the owner
    }

    struct memeToken {
        string name;
        string symbol;
        string description;
        string tokenImageUrl;
        uint fundingRaised;
        address tokenAddress;
        address creatorAddress;
    }

    address[] public memeTokenAddresses;
    mapping(address => memeToken) public addressToMemeTokenMapping;

    uint constant MEMETOKEN_CREATION_PLATFORM_FEE = 0.0001 ether;
    uint constant MEMECOIN_FUNDING_DEADLINE_DURATION = 10 days;
    uint constant MEMECOIN_FUNDING_GOAL = 10 ether;

    uint constant DECIMALS = 10 ** 18;
    uint constant MAX_SUPPLY = 1000000000 * DECIMALS;
    uint constant SELL_SUPPLY = 600000000 * DECIMALS;
    uint constant LP_SUPPLY = 400000000 * DECIMALS;
    uint constant INIT_SUPPLY = (20 * MAX_SUPPLY) / 100;

    uint256 public constant INITIAL_PRICE = 25000000000; // Initial price in wei (P0), 3.00 * 10^13
    uint256 public constant K = 8 * 10 ** 15; // Growth rate (k), scaled to avoid precision loss (0.01 * 10^18)

    address constant QiteSwap_ADDRESS =
        0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9;

    // Function to calculate the cost in wei for purchasing `tokensToBuy` starting from `currentSupply`
    // Function to calculate the cost in wei for purchasing `tokensToBuy` starting from `currentSupply`
    function calculateCost(
        uint256 currentSupply,
        uint256 tokensToBuy
    ) public pure returns (uint256) {
        // Scale currentSupply and tokensToBuy to avoid precision loss
        uint256 scaledCurrentSupply = currentSupply * 10 ** 18;
        uint256 scaledTokensToBuy = tokensToBuy * 10 ** 18;

        // Calculate exponent parts
        uint256 exponent1 = (K * (scaledCurrentSupply + scaledTokensToBuy)) /
            (10 ** 18);
        uint256 exponent2 = (K * scaledCurrentSupply) / (10 ** 18);

        // Calculate e^(kx) using exp function
        uint256 exp1 = exp(exponent1);
        uint256 exp2 = exp(exponent2);

        // Safeguard to avoid a zero difference
        uint256 minDifference = 10 ** 12; // A small threshold to avoid zero difference
        uint256 difference = exp1 > exp2 ? exp1 - exp2 : exp2 - exp1;

        // If the difference is too small, return a minimum cost to avoid errors
        if (difference < minDifference) {
            return INITIAL_PRICE;
        }

        // Calculate cost using the bonding curve formula
        uint256 cost = (INITIAL_PRICE * difference) / K;

        return cost;
    }

    function exp(uint256 x) internal pure returns (uint256) {
        // For very large x, use a simplified approximation
        if (x > 10 ** 20) {
            return 10 ** 18; // Cap the growth at a reasonable value
        }

        uint256 sum = 10 ** 18; // Start with 1 * 10^18 for precision
        uint256 term = 10 ** 18; // Initial term = 1 * 10^18
        uint256 xPower = x; // Initial power of x

        unchecked {
            for (uint256 i = 1; i <= 20; i++) {
                // Increase iterations for better accuracy
                term = (term * xPower) / (i * 10 ** 18); // x^i / i!
                sum += term;

                // Prevent overflow and unnecessary calculations
                if (term < 1) break;
            }
        }

        return sum;
    }

    function createMemeToken(
        string memory name,
        string memory symbol,
        string memory imageUrl,
        string memory description
    ) public payable returns (address) {
        //should deploy the meme token, mint the initial supply to the token factory contract
        require(
            msg.value >= MEMETOKEN_CREATION_PLATFORM_FEE,
            "fee not paid for memetoken creation"
        );
        Token ct = new Token(name, symbol, INIT_SUPPLY);
        address memeTokenAddress = address(ct);
        memeToken memory newlyCreatedToken = memeToken(
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
        return memeTokenAddress;
    }

    function buyMemeToken(
        address memeTokenAddress,
        uint tokenQty
    ) public payable {
        //check if memecoin is listed
        require(
            addressToMemeTokenMapping[memeTokenAddress].tokenAddress !=
                address(0),
            "Token is not listed"
        );
        require(msg.value > 0, "must be geater than zero");

        memeToken storage listedToken = addressToMemeTokenMapping[
            memeTokenAddress
        ];
        // check to ensure funding goal is not met
        require(
            listedToken.fundingRaised <= MEMECOIN_FUNDING_GOAL,
            "Funding has already been raised"
        );

        Token memeTokenCt = Token(memeTokenAddress);

        // check to ensure there is enough supply to facilitate the purchase
        uint currentSupply = memeTokenCt.totalSupply();
        console.log("Current supply of token is ", currentSupply);
        console.log("Max supply of token is ", MAX_SUPPLY);
        uint available_qty = SELL_SUPPLY - currentSupply;
        console.log("Qty available for purchase ", available_qty);

        uint scaled_available_qty = available_qty / DECIMALS;
        uint tokenQty_scaled = tokenQty * DECIMALS;

        require(
            tokenQty <= scaled_available_qty,
            "Not enough available supply"
        );

        // calculate the cost for purchasing tokenQty tokens as per the exponential bonding curve formula
        uint currentSupplyScaled = (currentSupply - INIT_SUPPLY) / DECIMALS;
        uint requiredEth = calculateCost(currentSupplyScaled, tokenQty);

        console.log("ETH required for purchasing meme tokens is ", requiredEth);

        // check if user has sent correct value of eth to facilitate this purchase
        require(msg.value >= requiredEth, "Incorrect value of ETH sent");

        uint256 sendBacketh = msg.value - requiredEth;

        console.log("remaning eth", sendBacketh);

        // Incerement the funding
        listedToken.fundingRaised += msg.value;

        // mint the tokens
        memeTokenCt.mint(tokenQty_scaled, msg.sender);

        if (listedToken.fundingRaised >= MEMECOIN_FUNDING_GOAL) {
            // create liquidity pool
            address pool = _createLiquidityPool(memeTokenAddress);
            console.log("Pool address ", pool);
            memeToken storage token = addressToMemeTokenMapping[
                memeTokenAddress
            ];
            // mint the tokens
            memeTokenCt.mint(LP_SUPPLY, address(this));
            console.log(
                "LP_SUPPLY minted",
                memeTokenCt.balanceOf(address(this))
            );
            _provideLiquidity(
                pool,
                memeTokenAddress,
                LP_SUPPLY,
                token.fundingRaised
            );
            console.log("lp provided ");
        }

        transferETH(payable(msg.sender), sendBacketh);

        console.log("ether send", msg.value);
        console.log(
            "User balance of the tokens is ",
            memeTokenCt.balanceOf(msg.sender)
        );
        // console.log("New available qty ", SELL_SUPPLY - memeTokenCt.totalSupply());
    }

    // sell token in bonding curve
    function sellToken(address tokenAddress, uint256 tokenAmount) public {
        memeToken storage listedToken = addressToMemeTokenMapping[tokenAddress];
        require(
            listedToken.fundingRaised <= MEMECOIN_FUNDING_GOAL,
            "Fundraising target reached"
        );
        Token memeTokenCt = Token(tokenAddress);
        require(tokenAmount > 0, "Amount must be greater than zero");

        address sender = msg.sender;
        require(sender != address(0), "Invalid sender address"); // Ensure sender is not zero address

        uint256 balance = memeTokenCt.balanceOf(sender);
        require(balance >= tokenAmount, "Insufficient token balance");

        uint currentSupply = memeTokenCt.totalSupply();
        // calculate the cost for purchasing tokenQty tokens as per the exponential bonding curve formula
        uint currentSupplyScaled = (currentSupply - INIT_SUPPLY) / DECIMALS;
        uint requiredEth = calculateCost(currentSupplyScaled, tokenAmount);

        transferETH(payable(msg.sender), requiredEth);

        console.log("ETH required for purchasing meme tokens is ", requiredEth);

        console.log(address(this));

        // Proceed with selling tokens
        memeTokenCt.burn(msg.sender, tokenAmount * DECIMALS);
    }

    // Add necessary logs to track where it fails
    function _createLiquidityPool(
        address memeTokenAddress
    ) internal returns (address) {
        console.log("Creating liquidity pool for token:", memeTokenAddress); // Log the token address
        QiteSwap qiteSwap = QiteSwap(QiteSwap_ADDRESS); // Make sure QiteSwap_ADDRESS is correct
        memeToken storage token = addressToMemeTokenMapping[memeTokenAddress];

        // Log before calling createPool
        console.log(
            "Calling createPool with token:",
            memeTokenAddress,
            " Name: ",
            token.name,
            " Symbol: ",
            token.symbol
        );

        address pool = qiteSwap.createPool(
            memeTokenAddress,
            token.name,
            token.symbol
        );

        console.log("Created pool address:", pool); // Log the pool address

        return pool;
    }

    function _provideLiquidity(
        address pool,
        address memeTokenAddress,
        uint tokenAmount,
        uint ethAmount
    ) internal returns (uint) {
        Token memeTokenCt = Token(memeTokenAddress);
        memeTokenCt.approve(pool, tokenAmount);
        QitePool qitePool = QitePool(payable(pool));
        qitePool.addLiquidity{value: ethAmount}(tokenAmount);
        return tokenAmount;
    }

    function calculateTokensPerEth(
        uint256 totalEth
    ) external pure returns (uint256) {
        require(totalEth > 0, "Total ETH must be greater than zero"); // Prevent division by zero
        uint256 perEthToken = LP_SUPPLY / MEMECOIN_FUNDING_GOAL; // Calculate tokens per ETH
        console.log(perEthToken);
        console.log(perEthToken * totalEth);
        return perEthToken * totalEth;
    }

    function blanceOf(
        address tokenAddress,
        address userAddress
    ) public view returns (uint256) {
        Token memeTokenCt = Token(tokenAddress);
        return memeTokenCt.balanceOf(userAddress);
    }

    function totalSupply(address tokenAddress) public view returns (uint256) {
        Token memeTokenCt = Token(tokenAddress);
        return memeTokenCt.totalSupply();
    }

    function getAllMemeTokens() public view returns (memeToken[] memory) {
        memeToken[] memory allTokens = new memeToken[](
            memeTokenAddresses.length
        );
        for (uint i = 0; i < memeTokenAddresses.length; i++) {
            allTokens[i] = addressToMemeTokenMapping[memeTokenAddresses[i]];
        }
        return allTokens;
    }

    // Function to transfer ETH from the contract to an address
    function transferETH(address payable _to, uint256 _amount) internal {
        require(msg.sender == owner, "Only the owner can withdraw");
        require(address(this).balance >= _amount, "Insufficient balance");

        _to.transfer(_amount);
    }

    function transferERC20(
        address tokenAddress,
        address userAddress,
        uint256 amount
    ) public {
        require(msg.sender == owner, "Only the owner can transfer tokens");
        require(tokenAddress != address(0), "Invalid token address");
        require(userAddress != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");

        Token tokenContract = Token(tokenAddress);
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient token balance");

        bool success = tokenContract.transfer(userAddress, amount);
        require(success, "token transfer failed");
    }
}
