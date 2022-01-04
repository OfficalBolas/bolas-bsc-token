const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');
const mnemonic = fs.readFileSync(".secret").toString().trim();

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",     // Localhost (default: none)
            port: 8545,            // Standard BSC port (default: none)
            network_id: "*",       // Any network (default: none)
        },
        local: {
            // use the ganache command
            // ganache-cli -f https://eth-mainnet.alchemyapi.io/v2/HDnpOSOi0m3ibwX1Lh1AtbSyggjFC1jW -l 80000000 -g 100000 --networkId 1 --defaultBalanceEther 10000 --unlock 0xe1474359c74e78fa8387d9cb58f393693e378de3
            host: "127.0.0.1",
            port: 8545,
            network_id: 1,
            gas: 40000000,
            gasPrice: 150000,
            gasLimit: 70000000,
            skipDryRun: true
        },
        testnet: {
            provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
            network_id: 97,
            confirmations: 10,
            timeoutBlocks: 200,
            skipDryRun: true
        },
        bsc: {
            provider: () => new HDWalletProvider(mnemonic, `https://bsc-dataseed1.binance.org`),
            network_id: 56,
            confirmations: 10,
            timeoutBlocks: 200,
            skipDryRun: true
        },
    },

    // Set default mocha options here, use special reporters etc.
    mocha: {
        // timeout: 100000
    },

    // Configure your compilers
    compilers: {
        solc: {
            version: "^0.8.2", // A version or constraint - Ex. "^0.5.0"
            settings: {          // See the solidity docs for advice about optimization and evmVersion
                optimizer: {
                    enabled: true,
                    runs: 200
                },
            }
        }
    },
}