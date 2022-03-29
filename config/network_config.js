const forking = {
    url: 'https://speedy-nodes-nyc.moralis.io/a92cffb2a6b25abb39cf1072/bsc/mainnet/archive',
    blockNumber: 16043640,
}
const networkConfigs = {
    hardhat: {
        uniswapAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        gasConfig: {
            gasLimit: 21000000,
            gasPrice: 150000000000,
        }
    },
    testnet: {
        uniswapAddress: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
        gasConfig: {
            gasLimit: 21000000,
            gasPrice: 10000000000,
        }
    },
    production: {
        uniswapAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        gasConfig: {
            gasLimit: 21000000,
            gasPrice: 7123000000,
        }
    },
}
module.exports = {
    forking,
    networkConfigs,
}