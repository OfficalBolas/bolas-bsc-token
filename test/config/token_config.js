const {tokenToRaw} = require("../utils/test_utils");
const decimals = 18;
const uniswap = {
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    minTokensBeforeSwap: tokenToRaw(60_000_000),
}
const fees = {
    taxFee: 3,
    liquidityFee: 2,
    burnFee: 5,
    marketingFee: 0,
    appFees: [0.5, 0.5, 0, 0, 0, 0],
}
const slippageTolerance = {
    minBuySlippage: 10,
    maxBuySlippage: 12,
    minSellSlippage: 10,
    maxSellSlippage: 15,
}

module.exports = {
    fees,
    slippageTolerance,
    decimals,
    uniswap,
}