// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUniswapV2Router02} from "../dex/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Factory} from "../dex/interfaces/IUniswapV2Factory.sol";
import {ILaunchpadFactoryV2} from "./ILaunchpadFactoryV2.sol";

/// @title BondingCurveV2
/// @notice Constant-product virtual-reserve curve. On graduation, seeds a
///         Uniswap v2 WETH/token pool. Graduation fees are split:
///         70% thickens the LP (extra ETH in pool), 30% to treasury.
contract BondingCurveV2 is ReentrancyGuard {
    IERC20 public immutable token;
    IUniswapV2Router02 public immutable router;
    ILaunchpadFactoryV2 public immutable factory;
    address public immutable feeRecipient;

    uint256 public immutable virtualEth;
    uint256 public immutable virtualToken;
    uint256 public immutable saleSupply;
    uint256 public immutable migrationSupply;
    uint256 public immutable K;
    uint256 public immutable graduationFeeBps;
    /// @notice Share of graduation fee ETH reinjected into LP (bps). Rest → treasury.
    uint256 public immutable feeToLpBps;

    uint256 public ethReserve;
    uint256 public tokensSold;
    bool public graduated;
    address public pair;

    event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 newTokensSold);
    event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 newTokensSold);
    event Graduated(
        address indexed pair,
        uint256 ethLiquidity,
        uint256 tokenLiquidity,
        uint256 treasuryFee,
        uint256 lpBoost
    );

    modifier live() {
        require(!graduated, "GRADUATED");
        _;
    }

    constructor(
        address token_,
        address router_,
        address factory_,
        address feeRecipient_,
        uint256 virtualEth_,
        uint256 virtualToken_,
        uint256 saleSupply_,
        uint256 migrationSupply_,
        uint256 graduationFeeBps_,
        uint256 feeToLpBps_
    ) {
        require(virtualToken_ > saleSupply_, "BAD_PARAMS");
        require(graduationFeeBps_ <= 2000, "FEE_TOO_HIGH");
        require(feeToLpBps_ <= 10_000, "BAD_LP_BPS");
        token = IERC20(token_);
        router = IUniswapV2Router02(router_);
        factory = ILaunchpadFactoryV2(factory_);
        feeRecipient = feeRecipient_;
        virtualEth = virtualEth_;
        virtualToken = virtualToken_;
        saleSupply = saleSupply_;
        migrationSupply = migrationSupply_;
        K = virtualEth_ * virtualToken_;
        graduationFeeBps = graduationFeeBps_;
        feeToLpBps = feeToLpBps_;
    }

    function graduationEth() public view returns (uint256) {
        return K / (virtualToken - saleSupply) - virtualEth;
    }

    function getBuyQuote(uint256 ethIn) public view returns (uint256 tokensOut, uint256 ethUsed) {
        uint256 x = virtualEth + ethReserve;
        uint256 y = virtualToken - tokensSold;
        uint256 out = y - K / (x + ethIn);
        uint256 remaining = saleSupply - tokensSold;
        if (out >= remaining) {
            tokensOut = remaining;
            ethUsed = K / (y - remaining) - x;
        } else {
            tokensOut = out;
            ethUsed = ethIn;
        }
    }

    function getSellQuote(uint256 tokensIn) public view returns (uint256 ethOut) {
        uint256 x = virtualEth + ethReserve;
        uint256 y = virtualToken - tokensSold;
        ethOut = x - K / (y + tokensIn);
    }

    function currentPrice() external view returns (uint256) {
        uint256 x = virtualEth + ethReserve;
        uint256 y = virtualToken - tokensSold;
        return (x * 1e18) / y;
    }

    function buy(uint256 minTokensOut, address to) public payable nonReentrant live returns (uint256 tokensOut) {
        require(msg.value > 0, "NO_ETH");
        uint256 ethUsed;
        (tokensOut, ethUsed) = getBuyQuote(msg.value);
        require(tokensOut >= minTokensOut, "SLIPPAGE");
        require(tokensOut > 0, "ZERO_OUT");

        ethReserve += ethUsed;
        tokensSold += tokensOut;
        require(token.transfer(to, tokensOut), "TOKEN_TRANSFER_FAILED");

        if (msg.value > ethUsed) {
            _safeTransferETH(to, msg.value - ethUsed);
        }

        emit Buy(to, ethUsed, tokensOut, tokensSold);

        if (tokensSold >= saleSupply) {
            _graduate();
        }
    }

    function sell(uint256 tokensIn, uint256 minEthOut, address to) external nonReentrant live returns (uint256 ethOut) {
        require(tokensIn > 0, "NO_TOKENS");
        require(tokensIn <= tokensSold, "EXCEEDS_SOLD");

        ethOut = getSellQuote(tokensIn);
        require(ethOut >= minEthOut, "SLIPPAGE");
        require(ethOut <= ethReserve, "INSUFFICIENT_RESERVE");

        ethReserve -= ethOut;
        tokensSold -= tokensIn;
        require(token.transferFrom(msg.sender, address(this), tokensIn), "TOKEN_TRANSFER_FAILED");
        _safeTransferETH(to, ethOut);

        emit Sell(msg.sender, tokensIn, ethOut, tokensSold);
    }

    function _graduate() private {
        graduated = true;

        uint256 raised = ethReserve;
        uint256 totalFee = (raised * graduationFeeBps) / 10000;
        uint256 lpBoost = (totalFee * feeToLpBps) / 10000;
        uint256 treasuryFee = totalFee - lpBoost;
        uint256 ethLiquidity = raised - treasuryFee;
        uint256 tokenLiquidity = token.balanceOf(address(this));

        if (treasuryFee > 0) {
            _safeTransferETH(feeRecipient, treasuryFee);
        }

        require(token.approve(address(router), tokenLiquidity), "APPROVE_FAILED");
        router.addLiquidityETH{value: ethLiquidity}(
            address(token),
            tokenLiquidity,
            0,
            0,
            address(0xdead),
            block.timestamp
        );

        pair = IUniswapV2Factory(router.factory()).getPair(address(token), router.WETH());
        factory.notifyGraduation();

        emit Graduated(pair, ethLiquidity, tokenLiquidity, treasuryFee, lpBoost);
    }

    function _safeTransferETH(address to, uint256 value) private {
        (bool ok, ) = to.call{value: value}("");
        require(ok, "ETH_TRANSFER_FAILED");
    }
}
