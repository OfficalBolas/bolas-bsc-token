const {tokenToRaw} = require("../utils/test_utils");
const decimals = 18;

const fees = {
    dividendFee: 3,
    liquidityFee: 1,
    burnFee: 6,
    marketingFee: 1,
    appFees: [0, 0, 0, 0, 0, 0],
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
}