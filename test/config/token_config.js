const {tokenToRaw} = require("../utils/test_utils");
const decimals = 18;
const uniswap = {
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    minTokensBeforeSwap: 10_000_000,
}
const fees = {
    dividendFee: 3,
    liquidityFee: 1,
    burnFee: 5,
    marketingFee: 1,
    appFees: [0.5, 0.5, 0, 0, 0, 0],
}
const slippageTolerance = {
    minBuySlippage: 10,
    maxBuySlippage: 13,
    minSellSlippage: 10,
    maxSellSlippage: 15,
}

module.exports = {
    fees,
    slippageTolerance,
    decimals,
    uniswap,
}