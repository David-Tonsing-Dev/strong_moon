// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./QiteLiquidityToken.sol";

contract QitePool {
    address public token;
    uint256 public ethwReserve;
    uint256 public tokenReserve;
    QiteLiquidityToken public liquidityToken;

    event AddLiquidity(
        address indexed provider,
        uint256 ethwAmount,
        uint256 tokenAmount,
        uint256 liquidity
    );
    event RemoveLiquidity(
        address indexed provider,
        uint256 ethwAmount,
        uint256 tokenAmount,
        uint256 liquidity
    );
    event Swap(address indexed user, uint256 amountIn, uint256 amountOut);

    constructor(address _token, string memory _name, string memory _symbol) {
        token = _token;
        liquidityToken = new QiteLiquidityToken(_name, _symbol);
    }

    receive() external payable {}

    function addLiquidity(uint256 tokenAmount) external payable {
        uint256 ethwAmount = msg.value;
        require(ethwAmount > 0 && tokenAmount > 0, "Invalid amounts");

        uint256 liquidity;
        if (ethwReserve == 0 && tokenReserve == 0) {
            liquidity = ethwAmount;
        } else {
            liquidity =
                (ethwAmount * liquidityToken.totalSupply()) /
                ethwReserve;
            require(
                (tokenAmount * liquidityToken.totalSupply()) / tokenReserve ==
                    liquidity,
                "Invalid ratio"
            );
        }

        liquidityToken.mint(msg.sender, liquidity);

        ethwReserve += ethwAmount;
        tokenReserve += tokenAmount;

        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        emit AddLiquidity(msg.sender, ethwAmount, tokenAmount, liquidity);
    }

    function removeLiquidity(uint256 liquidity) external {
        require(liquidity > 0, "Invalid liquidity");
        uint256 totalSupply = liquidityToken.totalSupply();

        uint256 ethwAmount = (liquidity * ethwReserve) / totalSupply;
        uint256 tokenAmount = (liquidity * tokenReserve) / totalSupply;

        liquidityToken.burn(msg.sender, liquidity);

        ethwReserve -= ethwAmount;
        tokenReserve -= tokenAmount;

        payable(msg.sender).transfer(ethwAmount);
        IERC20(token).transfer(msg.sender, tokenAmount);

        emit RemoveLiquidity(msg.sender, ethwAmount, tokenAmount, liquidity);
    }

    function swapTokens(bool isEthwToToken, uint256 amountIn) external payable {
        uint256 amountOut;
        uint256 amountInWithFee = (amountIn * 997) / 1000; // Apply 0.3% fee

        if (isEthwToToken) {
            require(msg.value == amountIn, "ETHW mismatch");

            // Calculate token output
            amountOut =
                (amountInWithFee * tokenReserve) /
                (ethwReserve + amountInWithFee);
            require(amountOut > 0, "Insufficient output amount");

            ethwReserve += amountIn; // Update ETHW reserve
            tokenReserve -= amountOut; // Update token reserve

            IERC20(token).transfer(msg.sender, amountOut); // Send tokens to user
        } else {
            require(
                amountIn <= IERC20(token).balanceOf(msg.sender),
                "Insufficient token balance"
            );

            // Approve and transfer tokens to the pool
            IERC20(token).transferFrom(msg.sender, address(this), amountIn);

            // Calculate ETHW output
            amountOut =
                (amountInWithFee * ethwReserve) /
                (tokenReserve + amountInWithFee);
            require(amountOut > 0, "Insufficient output amount");

            ethwReserve -= amountOut; // Update ETHW reserve
            tokenReserve += amountIn; // Update token reserve

            payable(msg.sender).transfer(amountOut); // Send ETHW to user
        }

        emit Swap(msg.sender, amountIn, amountOut);
    }

    function getSwapOutput(
        bool isEthwToToken,
        uint256 amountIn
    ) public view returns (uint256) {
        uint256 amountInWithFee = (amountIn * 997) / 1000; // Apply 0.3% fee
        if (isEthwToToken) {
            // Calculate token output for ETHW input
            return
                (amountInWithFee * tokenReserve) /
                (ethwReserve + amountInWithFee);
        } else {
            // Calculate ETHW output for token input
            return
                (amountInWithFee * ethwReserve) /
                (tokenReserve + amountInWithFee);
        }
    }

    function getRequiredTokenAmount(
        uint256 ethwAmount
    ) public view returns (uint256) {
        require(
            ethwReserve > 0 && tokenReserve > 0,
            "Insufficient pool reserves"
        );
        return (ethwAmount * tokenReserve) / ethwReserve;
    }

    function getRequiredEthwAmount(
        uint256 tokenAmount
    ) public view returns (uint256) {
        require(
            ethwReserve > 0 && tokenReserve > 0,
            "Insufficient pool reserves"
        );
        return (tokenAmount * ethwReserve) / tokenReserve;
    }

    function getUserLiquidity(address user) external view returns (uint256) {
        return liquidityToken.balanceOf(user);
    }

    function getLPTokenAddress() external view returns (address) {
        return address(liquidityToken);
    }
}
