const forking = {
    url: 'https://eth-mainnet.alchemyapi.io/v2/HDnpOSOi0m3ibwX1Lh1AtbSyggjFC1jW',
    blockNumber: 13948000,
}
const gasConfigs = {
    hardhat: {
        gasLimit: 21000000,
        gasPrice: 150000000000,
    },
    testnet: {
        gasLimit: 21000000,
        gasPrice: 80000000000,
    },
}
module.exports = {
    forking,
    gasConfigs,
}