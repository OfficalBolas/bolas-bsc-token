// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract BOLAS is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address public marketingWallet;

    function initialize(address _marketingWallet) initializer public {
        __ERC20_init("BOLAS", "BOLAS");
        __Ownable_init();
        __UUPSUpgradeable_init();

        marketingWallet = _marketingWallet;

        _mint(msg.sender, 160000000000000 * 10 ** decimals());
    }

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyOwner
    override
    {}
}
