// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUniswapV2Router02} from "../dex/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Factory} from "../dex/interfaces/IUniswapV2Factory.sol";

/// @title BondingCurveV2
/// @notice Same constant-product virtual-reserve curve as BondingCurve, but
///         graduation seeds a standard **Uniswap v2** WETH/token pool through a
///         v2 router (the canonical Uniswap deployment on Robinhood Chain, or
///         our own FletchSwap v2 fork). Standard v2 pairs emit the events that
///         DEX aggregators (DEXScreener etc.) index automatically, so every
///         graduated token charts with zero extra integration.
///
///         Curve invariant: (X0 + ethReserve) * (Y0 - tokensSold) == X0 * Y0
contract BondingCurveV2 is ReentrancyGuard {
    // ---- immutable config ----
    IERC20 public immutable token;
    IUniswapV2Router02 public immutable router;
    address public immutable feeRecipient;

    uint256 public immutable virtualEth; // X0
    uint256 public immutable virtualToken; // Y0
    uint256 public immutable saleSupply; // tokens sellable via the curve
    uint256 public immutable migrationSupply; // tokens seeded into the AMM at graduation
    uint256 public immutable K; // X0 * Y0
    uint256 public immutable graduationFeeBps; // platform fee on raised ETH at graduation

    // ---- state ----
    uint256 public ethReserve; // real ETH collected and held for the curve
    uint256 public tokensSold; // tokens sold along the curve
    bool public graduated;
    address public pair; // WETH/token v2 pair, set at graduation

    event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 newTokensSold);
    event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 newTokensSold);
    event Graduated(address indexed pair, uint256 ethLiquidity, uint256 tokenLiquidity, uint256 fee);

    modifier live() {
        require(!graduated, "GRADUATED");
        _;
    }

    constructor(
        address token_,
        address router_,
        address feeRecipient_,
        uint256 virtualEth_,
        uint256 virtualToken_,
        uint256 saleSupply_,
        uint256 migrationSupply_,
        uint256 graduationFeeBps_
    ) {
        require(virtualToken_ > saleSupply_, "BAD_PARAMS");
        require(graduationFeeBps_ <= 2000, "FEE_TOO_HIGH");
        token = IERC20(token_);
        router = IUniswapV2Router02(router_);
        feeRecipient = feeRecipient_;
        virtualEth = virtualEth_;
        virtualToken = virtualToken_;
        saleSupply = saleSupply_;
        migrationSupply = migrationSupply_;
        K = virtualEth_ * virtualToken_;
        graduationFeeBps = graduationFeeBps_;
    }

    // ---------------------------------------------------------------- views

    /// @notice ETH that will have been raised into the curve once it graduates.
    function graduationEth() public view returns (uint256) {
        return K / (virtualToken - saleSupply) - virtualEth;
    }

    /// @notice Tokens received for `ethIn`, capped at remaining sale supply.
    function getBuyQuote(uint256 ethIn) public view returns (uint256 tokensOut, uint256 ethUsed) {
        uint256 x = virtualEth + ethReserve;
        uint256 y = virtualToken - tokensSold;
        uint256 out = y - K / (x + ethIn);
        uint256 remaining = saleSupply - tokensSold;
        if (out >= remaining) {
            tokensOut = remaining;
            ethUsed = K / (y - remaining) - x; // exact ETH to buy the rest
        } else {
            tokensOut = out;
            ethUsed = ethIn;
        }
    }

    /// @notice ETH received for selling `tokensIn` back to the curve.
    function getSellQuote(uint256 tokensIn) public view returns (uint256 ethOut) {
        uint256 x = virtualEth + ethReserve;
        uint256 y = virtualToken - tokensSold;
        ethOut = x - K / (y + tokensIn);
    }

    /// @notice Current spot price in wei per whole token (1e18 units).
    function currentPrice() external view returns (uint256) {
        uint256 x = virtualEth + ethReserve;
        uint256 y = virtualToken - tokensSold;
        return (x * 1e18) / y;
    }

    // ---------------------------------------------------------------- trading

    function buy(uint256 minTokensOut, address to) public payable nonReentrant live returns (uint256 tokensOut) {
        require(msg.value > 0, "NO_ETH");
        uint256 ethUsed;
        (tokensOut, ethUsed) = getBuyQuote(msg.value);
        require(tokensOut >= minTokensOut, "SLIPPAGE");
        require(tokensOut > 0, "ZERO_OUT");

        ethReserve += ethUsed;
        tokensSold += tokensOut;

        require(token.transfer(to, tokensOut), "TOKEN_TRANSFER_FAILED");

        // refund any ETH beyond what was needed to finish the curve
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

    // ---------------------------------------------------------------- graduation

    function _graduate() private {
        graduated = true;

        uint256 raised = ethReserve;
        uint256 fee = (raised * graduationFeeBps) / 10000;
        uint256 ethLiquidity = raised - fee;
        uint256 tokenLiquidity = token.balanceOf(address(this)); // == migrationSupply

        if (fee > 0) {
            _safeTransferETH(feeRecipient, fee);
        }

        require(token.approve(address(router), tokenLiquidity), "APPROVE_FAILED");
        // Seed the WETH/token v2 pool; LP is minted straight to the dead
        // address so liquidity is locked forever.
        router.addLiquidityETH{value: ethLiquidity}(
            address(token),
            tokenLiquidity,
            0,
            0,
            address(0xdead),
            block.timestamp
        );

        pair = IUniswapV2Factory(router.factory()).getPair(address(token), router.WETH());

        emit Graduated(pair, ethLiquidity, tokenLiquidity, fee);
    }

    function _safeTransferETH(address to, uint256 value) private {
        (bool ok, ) = to.call{value: value}("");
        require(ok, "ETH_TRANSFER_FAILED");
    }
}
