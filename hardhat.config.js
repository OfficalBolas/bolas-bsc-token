/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-truffle5");
require('hardhat-deploy');

module.exports = {
    namedAccounts: {
        deployer: 0,
        tokenOwner: 1,
    },
    networks: {
        hardhat: {
            chainId: 999,
            loggingEnabled: false,
            forking: {
                url: 'https://eth-mainnet.alchemyapi.io/v2/HDnpOSOi0m3ibwX1Lh1AtbSyggjFC1jW',
                blockNumber: 13948000,
                enabled: true,
            }
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
};
