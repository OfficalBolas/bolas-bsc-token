const decimals = 18;
const fees = {
    taxFee: 3,
    liquidityFee: 2,
    burnFee: 6,
    marketingFee: 0,
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
}