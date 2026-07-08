// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PumpSwapPair} from "./PumpSwapPair.sol";

/// @title PumpSwapFactory
/// @notice Deploys and tracks ETH<>token AMM pairs. One pair per token.
contract PumpSwapFactory {
    mapping(address => address) public getPair; // token => pair
    address[] public allPairs;

    event PairCreated(address indexed token, address pair, uint256 index);

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address token) external returns (address pair) {
        require(token != address(0), "ZERO_ADDRESS");
        require(getPair[token] == address(0), "PAIR_EXISTS");
        PumpSwapPair newPair = new PumpSwapPair(token);
        pair = address(newPair);
        getPair[token] = pair;
        allPairs.push(pair);
        emit PairCreated(token, pair, allPairs.length - 1);
    }
}
