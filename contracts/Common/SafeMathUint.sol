// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

/**
 * @title SafeMathUint
 * @dev Math operations with safety checks that revert on error
 */
library SafeMathUint {
    function toInt256Safe(uint256 a) internal pure returns (int256) {
        int256 b = int256(a);
        require(b >= 0, "Negative number is not allowed");
        return b;
    }
}