pragma solidity ^0.6.2;

// SPDX-License-Identifier: MIT License

import "./Ownable.sol";
import "./IterableMapping.sol";

contract Adminable is Ownable {
    using IterableMapping for IterableMapping.Map;

    // owner() handles owner
    // 0 = not admin, 1 = manger of admins, 2 = most functions, 3 = low level admin, 4 = automated
    IterableMapping.Map private adminMap;

    event AdminUpdated(address indexed newAdmin, uint256 level);

    constructor() public {}

    // This also allows owner
    modifier onlyAdmin(uint256 level) {
        address msgSender = _msgSender();
        uint256 adminLevel = adminMap.get(msgSender);
        require(
            msgSender == owner() || (adminLevel != 0 && adminLevel <= level),
            "Admin: caller is not an admin for this level"
        );
        _;
    }

    function _setAdminLevel(address newAdmin, uint256 level) internal {
        emit AdminUpdated(newAdmin, level);
        adminMap.set(newAdmin, level);
    }

    function _removeAdmin(address oldAdmin) internal {
        emit AdminUpdated(oldAdmin, 0);
        adminMap.remove(oldAdmin);
    }

    function setAdminLevel(address newAdmin, uint256 level)
    external
    onlyAdmin(1)
    {
        _setAdminLevel(newAdmin, level);
    }

    function removeAdmin(address oldAdmin) external onlyAdmin(1) {
        uint256 oldAdminLevel = adminMap.get(oldAdmin);
        require(oldAdminLevel != 0, "This person is already not an admin");
        _removeAdmin(oldAdmin);
    }

    function isAdmin(address admin) public view returns (uint256) {
        return adminMap.get(admin);
    }

    function getAllAdmin() public view returns (address[] memory) {
        return adminMap.keys;
    }
}