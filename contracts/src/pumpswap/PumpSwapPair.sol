// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PumpSwapPair
/// @notice A minimal constant-product AMM pair between native ETH and one ERC20
///         token. The pair itself is the LP token (ERC20). Router logic is
///         merged in for a lean MVP: users add/remove liquidity and swap
///         directly against the pair. Fee is 0.30% and accrues to LPs.
contract PumpSwapPair is ERC20, ReentrancyGuard {
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 private constant FEE_NUM = 997;
    uint256 private constant FEE_DEN = 1000;

    address public immutable factory;
    IERC20 public immutable token;

    uint112 private reserveETH;
    uint112 private reserveToken;

    event Mint(address indexed sender, uint256 amountETH, uint256 amountToken, uint256 liquidity);
    event Burn(address indexed sender, uint256 amountETH, uint256 amountToken, address indexed to);
    event Swap(
        address indexed sender,
        bool ethIn,
        uint256 amountIn,
        uint256 amountOut,
        address indexed to
    );
    event Sync(uint112 reserveETH, uint112 reserveToken);

    constructor(address token_) ERC20("PumpSwap LP", "PS-LP") {
        factory = msg.sender;
        token = IERC20(token_);
    }

    function getReserves() public view returns (uint112 _reserveETH, uint112 _reserveToken) {
        _reserveETH = reserveETH;
        _reserveToken = reserveToken;
    }

    function _update(uint256 balanceETH, uint256 balanceToken) private {
        require(balanceETH <= type(uint112).max && balanceToken <= type(uint112).max, "OVERFLOW");
        reserveETH = uint112(balanceETH);
        reserveToken = uint112(balanceToken);
        emit Sync(reserveETH, reserveToken);
    }

    /// @notice Add liquidity. Caller must approve `amountTokenDesired` first.
    ///         ETH is sent as msg.value. For the first deposit, the exact
    ///         provided amounts define the initial price.
    function addLiquidity(
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to
    ) external payable nonReentrant returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        (uint112 rETH, uint112 rToken) = getReserves();
        uint256 amountETHDesired = msg.value;

        if (rETH == 0 && rToken == 0) {
            amountToken = amountTokenDesired;
            amountETH = amountETHDesired;
        } else {
            uint256 amountETHOptimal = (amountTokenDesired * rETH) / rToken;
            if (amountETHOptimal <= amountETHDesired) {
                require(amountETHOptimal >= amountETHMin, "INSUFFICIENT_ETH");
                amountToken = amountTokenDesired;
                amountETH = amountETHOptimal;
            } else {
                uint256 amountTokenOptimal = (amountETHDesired * rToken) / rETH;
                require(amountTokenOptimal <= amountTokenDesired, "EXCESS_TOKEN");
                require(amountTokenOptimal >= amountTokenMin, "INSUFFICIENT_TOKEN");
                amountToken = amountTokenOptimal;
                amountETH = amountETHDesired;
            }
        }

        require(IERC20(token).transferFrom(msg.sender, address(this), amountToken), "TOKEN_TRANSFER_FAILED");

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = _sqrt(amountETH * amountToken) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY); // permanently lock minimum liquidity
        } else {
            uint256 liqA = (amountETH * _totalSupply) / rETH;
            uint256 liqB = (amountToken * _totalSupply) / rToken;
            liquidity = liqA < liqB ? liqA : liqB;
        }
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        // refund any unused ETH (when optimal < desired)
        if (amountETHDesired > amountETH) {
            _safeTransferETH(msg.sender, amountETHDesired - amountETH);
        }

        _update(address(this).balance, IERC20(token).balanceOf(address(this)));
        emit Mint(msg.sender, amountETH, amountToken, liquidity);
    }

    function removeLiquidity(
        uint256 liquidity,
        uint256 amountETHMin,
        uint256 amountTokenMin,
        address to
    ) external nonReentrant returns (uint256 amountETH, uint256 amountToken) {
        uint256 _totalSupply = totalSupply();
        uint256 balanceETH = address(this).balance;
        uint256 balanceToken = IERC20(token).balanceOf(address(this));

        amountETH = (liquidity * balanceETH) / _totalSupply;
        amountToken = (liquidity * balanceToken) / _totalSupply;
        require(amountETH >= amountETHMin, "INSUFFICIENT_ETH");
        require(amountToken >= amountTokenMin, "INSUFFICIENT_TOKEN");
        require(amountETH > 0 && amountToken > 0, "INSUFFICIENT_LIQUIDITY_BURNED");

        _burn(msg.sender, liquidity);
        _safeTransferETH(to, amountETH);
        require(IERC20(token).transfer(to, amountToken), "TOKEN_TRANSFER_FAILED");

        _update(address(this).balance, IERC20(token).balanceOf(address(this)));
        emit Burn(msg.sender, amountETH, amountToken, to);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256)
    {
        require(amountIn > 0, "INSUFFICIENT_INPUT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * FEE_NUM;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * FEE_DEN + amountInWithFee;
        return numerator / denominator;
    }

    function swapExactETHForTokens(uint256 amountOutMin, address to)
        external
        payable
        nonReentrant
        returns (uint256 amountOut)
    {
        (uint112 rETH, uint112 rToken) = getReserves();
        amountOut = getAmountOut(msg.value, rETH, rToken);
        require(amountOut >= amountOutMin, "SLIPPAGE");
        require(IERC20(token).transfer(to, amountOut), "TOKEN_TRANSFER_FAILED");
        _update(address(this).balance, IERC20(token).balanceOf(address(this)));
        emit Swap(msg.sender, true, msg.value, amountOut, to);
    }

    function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        (uint112 rETH, uint112 rToken) = getReserves();
        require(IERC20(token).transferFrom(msg.sender, address(this), amountIn), "TOKEN_TRANSFER_FAILED");
        amountOut = getAmountOut(amountIn, rToken, rETH);
        require(amountOut >= amountOutMin, "SLIPPAGE");
        _safeTransferETH(to, amountOut);
        _update(address(this).balance, IERC20(token).balanceOf(address(this)));
        emit Swap(msg.sender, false, amountIn, amountOut, to);
    }

    function _safeTransferETH(address to, uint256 value) private {
        (bool ok, ) = to.call{value: value}("");
        require(ok, "ETH_TRANSFER_FAILED");
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
