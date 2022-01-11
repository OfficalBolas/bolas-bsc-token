const forking = {
    url: 'https://eth-mainnet.alchemyapi.io/v2/HDnpOSOi0m3ibwX1Lh1AtbSyggjFC1jW',
    blockNumber: 13948000,
}
const networkConfigs = {
    hardhat: {
        uniswapAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
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
            gasPrice: 10000000000,
        }
    },
}
module.exports = {
    forking,
    networkConfigs,
}