// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Launchpad Token
/// @notice A fixed-supply ERC20. The full supply is minted to `recipient`
///         (the BondingCurve) at deployment. There is no owner and no further
///         minting, so supply is immutable after creation.
contract Token is ERC20 {
    uint8 private constant _DECIMALS = 18;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address recipient
    ) ERC20(name_, symbol_) {
        _mint(recipient, totalSupply_);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
}
