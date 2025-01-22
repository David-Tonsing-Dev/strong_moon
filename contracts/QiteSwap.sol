// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./QitePool.sol";
import "hardhat/console.sol";

contract QiteSwap {
    mapping(address => address) public getPair;
    address[] public allPools;

    event PoolCreated(address indexed token, address pool);

    function createPool(
        address token,
        string memory name,
        string memory symbol
    ) external returns (address) {
        require(getPair[token] == address(0), "Pool already exists");
        console.log("=================1");
        QitePool pool = new QitePool(token, name, symbol);
        console.log("=================2");
        address poolAddress = address(pool);
        console.log("=================3");
        getPair[token] = poolAddress;
        allPools.push(poolAddress);
        console.log("=================4");
        emit PoolCreated(token, poolAddress);
        return poolAddress;
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }
}
