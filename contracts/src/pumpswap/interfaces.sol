// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPumpSwapFactory {
    function getPair(address token) external view returns (address);
    function createPair(address token) external returns (address pair);
}

interface IPumpSwapPair {
    function addLiquidity(
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function swapExactETHForTokens(uint256 amountOutMin, address to)
        external
        payable
        returns (uint256 amountOut);

    function getReserves() external view returns (uint112 reserveETH, uint112 reserveToken);
}
