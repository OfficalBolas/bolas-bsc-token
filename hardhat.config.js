/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-etherscan");
require('hardhat-deploy');
const {forking} = require("./config/network_config");
const fs = require("fs");
const mnemonic = fs.readFileSync(".secret").toString().trim();

module.exports = {
    defaultNetwork: 'hardhat',
    namedAccounts: {
        deployer: 0,
        tokenOwner: 0,
        liquidityWallet: 7,
        marketingWallet: 8,
        appWallet: 9,
    },
    networks: {
        hardhat: {
            chainId: 999,
            loggingEnabled: false,
            forking: forking,
            allowUnlimitedContractSize: false,
        },
        testnet: {
            url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
            network_id: 97,
            loggingEnabled: true,
            accounts: {
                mnemonic: mnemonic,
            },
        },
        production: {
            url: `https://bsc-dataseed.binance.org/`,
            network_id: 56,
            loggingEnabled: true,
            accounts: {
                mnemonic: mnemonic,
            },
        },
    },
    etherscan: {
        apiKey: {
            // binance smart chain
            bsc: "27C7T2PBAPH1PQ8HI8MFGT4BYH8D6SZ1P1",
            bscTestnet: "27C7T2PBAPH1PQ8HI8MFGT4BYH8D6SZ1P1",
        }
    },
    solidity: {
        version: "0.8.2",
        settings: {
            optimizer: {
                enabled: true,
                runs: 9999
            }
        }
    },
    mocha: {
        timeout: 200000
    },
};