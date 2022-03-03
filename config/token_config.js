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
    maxBuySlippage: 14,
    minSellSlippage: 10,
    maxSellSlippage: 14,
}

const staking = {
    hourlyRewardFor7Days: 0.001,
    hourlyRewardFor30Days: 0.002,
    hourlyRewardFor90Days: 0.003,
    hourlyRewardFor365Days: 0.004,
}

module.exports = {
    fees,
    slippageTolerance,
    decimals,
    staking
}