// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Token} from "./Token.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LaunchpadFactory
/// @notice pump.fun-style launchpad. Anyone can create a token; the factory
///         deploys a fixed-supply ERC20 and a BondingCurve, seeds the curve
///         with the whole supply, and (optionally) performs a first buy in the
///         same transaction. All tokens graduate to PumpSwap.
contract LaunchpadFactory is Ownable {
    // ---- curve economics (immutable, set at deploy) ----
    uint256 public immutable totalSupply_;
    uint256 public immutable saleSupply;
    uint256 public immutable migrationSupply;
    uint256 public immutable virtualEth;
    uint256 public immutable virtualToken;
    uint256 public immutable graduationFeeBps;

    address public immutable swapFactory;
    /// @notice Destination for graduation fees (typically the treasury wallet).
    ///         Fees accumulate as ETH; buybacks are executed manually off-chain.
    ///         Owner-updatable via setFeeRecipient.
    address public feeRecipient;

    struct TokenInfo {
        address token;
        address curve;
        string name;
        string symbol;
        string description;
        string image;
        string twitter;
        string telegram;
        string website;
        address creator;
        uint256 createdAt;
    }

    TokenInfo[] public tokens;
    mapping(address => uint256) public tokenIndex; // token address => index+1 (0 = not found)
    mapping(address => address) public curveOf; // token => curve

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint256 index
    );
    event FeeRecipientUpdated(address indexed feeRecipient);

    constructor(
        address swapFactory_,
        address feeRecipient_,
        uint256 totalSupply__,
        uint256 saleSupply_,
        uint256 virtualEth_,
        uint256 virtualToken_,
        uint256 graduationFeeBps_
    ) Ownable(msg.sender) {
        require(totalSupply__ > saleSupply_, "BAD_SUPPLY");
        swapFactory = swapFactory_;
        feeRecipient = feeRecipient_;
        totalSupply_ = totalSupply__;
        saleSupply = saleSupply_;
        migrationSupply = totalSupply__ - saleSupply_;
        virtualEth = virtualEth_;
        virtualToken = virtualToken_;
        graduationFeeBps = graduationFeeBps_;
    }

    /// @notice Update where future tokens send their graduation fees.
    function setFeeRecipient(address feeRecipient_) external onlyOwner {
        require(feeRecipient_ != address(0), "ZERO");
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata description,
        string calldata image,
        string calldata twitter,
        string calldata telegram,
        string calldata website
    ) external payable returns (address tokenAddr, address curveAddr) {
        Token token = new Token(name, symbol, totalSupply_, address(this));

        BondingCurve curve = new BondingCurve(
            address(token),
            swapFactory,
            feeRecipient,
            virtualEth,
            virtualToken,
            saleSupply,
            migrationSupply,
            graduationFeeBps
        );

        require(token.transfer(address(curve), totalSupply_), "SEED_FAILED");

        tokenAddr = address(token);
        curveAddr = address(curve);

        tokens.push(
            TokenInfo({
                token: tokenAddr,
                curve: curveAddr,
                name: name,
                symbol: symbol,
                description: description,
                image: image,
                twitter: twitter,
                telegram: telegram,
                website: website,
                creator: msg.sender,
                createdAt: block.timestamp
            })
        );
        uint256 idx = tokens.length - 1;
        tokenIndex[tokenAddr] = idx + 1;
        curveOf[tokenAddr] = curveAddr;

        emit TokenCreated(tokenAddr, curveAddr, msg.sender, name, symbol, idx);

        // optional dev buy in the same tx
        if (msg.value > 0) {
            curve.buy{value: msg.value}(0, msg.sender);
        }
    }

    // ---------------------------------------------------------------- views

    function tokenCount() external view returns (uint256) {
        return tokens.length;
    }

    /// @notice Returns a page of tokens, newest first.
    function getTokens(uint256 offset, uint256 limit) external view returns (TokenInfo[] memory page) {
        uint256 len = tokens.length;
        if (offset >= len) {
            return new TokenInfo[](0);
        }
        uint256 end = len - offset; // exclusive upper bound in ascending array
        uint256 start = end > limit ? end - limit : 0;
        uint256 n = end - start;
        page = new TokenInfo[](n);
        for (uint256 i = 0; i < n; i++) {
            page[i] = tokens[end - 1 - i]; // newest first
        }
    }

    function getToken(address token) external view returns (TokenInfo memory) {
        uint256 idx = tokenIndex[token];
        require(idx != 0, "UNKNOWN_TOKEN");
        return tokens[idx - 1];
    }
}
