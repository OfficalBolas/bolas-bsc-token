const decimals = 18;

const fees = {
    dividendFee: 3,
    liquidityFee: 1,
    burnFee: 6,
    marketingFee: 1,
    stakingFee: 2,
    appFees: [0, 0, 0, 0, 0, 0],
}
const slippageTolerance = {
    minBuySlippage: 10,
    maxBuySlippage: 14,
    minSellSlippage: 10,
    maxSellSlippage: 14,
}

const staking = {
    apy7Days: 0.2,
    apy30Days: 0.50,
    apy90Days: 1,
    apy365Days: 2,
}

module.exports = {
    fees,
    slippageTolerance,
    decimals,
    staking
}