/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-truffle5");
require('hardhat-deploy');
const {forking} = require("./test/config/network_config");

module.exports = {
    namedAccounts: {
        deployer: 0,
        tokenOwner: 1,
        liquidityWallet: 7,
        marketingWallet: 8,
        appWallet: 9,
    },
    networks: {
        hardhat: {
            chainId: 999,
            loggingEnabled: false,
            forking: forking,
            allowUnlimitedContractSize: true,
        }
    },
    solidity: {
        version: "0.8.2",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    mocha: {
        timeout: 200000
    },
};
