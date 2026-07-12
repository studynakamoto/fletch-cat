// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Token} from "../Token.sol";
import {BondingCurveV2} from "./BondingCurveV2.sol";

/// @title LaunchpadFactoryV2
/// @notice V2 launchpad: 2% platform-token skim on create, decaying graduation
///         fees, and LP-thickening fee split. Graduates into Uniswap v2.
contract LaunchpadFactoryV2 is Ownable {
    address public immutable router;
    address public immutable feeRecipient;
    uint256 public immutable totalSupply;
    uint256 public immutable virtualEth;
    uint256 public immutable virtualToken;
    uint256 public immutable saleSupply;
    uint256 public immutable migrationSupply;
    /// @notice Bps of total supply skimmed to treasury on every launch (e.g. 200 = 2%).
    uint256 public immutable platformTokenBps;
    /// @notice Starting graduation fee (bps). Decays with `graduationCount`.
    uint256 public immutable maxGraduationFeeBps;
    uint256 public immutable minGraduationFeeBps;
    uint256 public immutable feeDecayStepBps;
    /// @notice Graduations per decay step (usually 1).
    uint256 public immutable feeDecayInterval;
    /// @notice Share of graduation fee ETH reinjected into LP (bps).
    uint256 public immutable feeToLpBps;

    uint256 public graduationCount;

    mapping(address => address) public curveOf;
    mapping(address => address) public tokenOf;

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        string image,
        string description,
        string twitter,
        string telegram,
        string website,
        uint256 platformSkim,
        uint256 graduationFeeBps
    );

    constructor(
        address router_,
        address feeRecipient_,
        uint256 totalSupply_,
        uint256 virtualEth_,
        uint256 virtualToken_,
        uint256 saleBpsOfCurve_, // e.g. 8000 = 80% of post-skim supply sold on curve
        uint256 platformTokenBps_,
        uint256 maxGraduationFeeBps_,
        uint256 minGraduationFeeBps_,
        uint256 feeDecayStepBps_,
        uint256 feeDecayInterval_,
        uint256 feeToLpBps_
    ) Ownable(msg.sender) {
        require(router_ != address(0) && feeRecipient_ != address(0), "ZERO_ADDR");
        require(platformTokenBps_ <= 1000, "SKIM_TOO_HIGH");
        require(maxGraduationFeeBps_ >= minGraduationFeeBps_, "BAD_FEE_RANGE");
        require(feeDecayInterval_ > 0, "BAD_INTERVAL");
        require(feeToLpBps_ <= 10_000, "BAD_LP_BPS");

        router = router_;
        feeRecipient = feeRecipient_;
        totalSupply = totalSupply_;
        virtualEth = virtualEth_;
        virtualToken = virtualToken_;
        platformTokenBps = platformTokenBps_;

        uint256 skim = (totalSupply_ * platformTokenBps_) / 10_000;
        uint256 curveSupply = totalSupply_ - skim;
        saleSupply = (curveSupply * saleBpsOfCurve_) / 10_000;
        migrationSupply = curveSupply - saleSupply;

        maxGraduationFeeBps = maxGraduationFeeBps_;
        minGraduationFeeBps = minGraduationFeeBps_;
        feeDecayStepBps = feeDecayStepBps_;
        feeDecayInterval = feeDecayInterval_;
        feeToLpBps = feeToLpBps_;
    }

    /// @notice Current graduation fee for newly created curves (decays with usage).
    function currentGraduationFeeBps() public view returns (uint256) {
        uint256 steps = graduationCount / feeDecayInterval;
        uint256 reduction = steps * feeDecayStepBps;
        uint256 headroom = maxGraduationFeeBps - minGraduationFeeBps;
        if (reduction >= headroom) return minGraduationFeeBps;
        return maxGraduationFeeBps - reduction;
    }

    /// @dev Called by BondingCurveV2 after graduation. Only registered curves.
    function notifyGraduation() external {
        require(curveOf[msg.sender] != address(0), "NOT_CURVE");
        graduationCount++;
    }

    function createToken(
        string calldata name_,
        string calldata symbol_,
        string calldata image_,
        string calldata description_,
        string calldata twitter_,
        string calldata telegram_,
        string calldata website_
    ) external returns (address token, address curve) {
        uint256 feeBps = currentGraduationFeeBps();

        Token t = new Token(name_, symbol_, totalSupply, address(this));
        token = address(t);

        BondingCurveV2 c = new BondingCurveV2(
            token,
            router,
            address(this),
            feeRecipient,
            virtualEth,
            virtualToken,
            saleSupply,
            migrationSupply,
            feeBps,
            feeToLpBps
        );
        curve = address(c);

        uint256 skim = (totalSupply * platformTokenBps) / 10_000;
        uint256 toCurve = totalSupply - skim;

        require(t.transfer(feeRecipient, skim), "SKIM_FAILED");
        require(t.transfer(curve, toCurve), "CURVE_TRANSFER_FAILED");

        curveOf[curve] = token;
        tokenOf[token] = curve;

        emit TokenCreated(
            token,
            curve,
            msg.sender,
            name_,
            symbol_,
            image_,
            description_,
            twitter_,
            telegram_,
            website_,
            skim,
            feeBps
        );
    }
}
