const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')

function getTransferAmount(amount, config) {
    const taxAmount = amount * config.taxFee / 100;
    const liquidityAmount = amount * config.liquidityFee / 100;
    const intermediateAmount = amount - (taxAmount + liquidityAmount);
    const burnAmount = intermediateAmount * config.burnFee / 100;
    const charityAmount = intermediateAmount * config.charityFee / 100;
    return intermediateAmount - (burnAmount + charityAmount);
}

async function getTokenPairOfUniswapFactory(token) {
    return IUniswapV2Pair.at(await token.uniswapV2Pair());
}

module.exports = {
    getTransferAmount,
    getTokenPairOfUniswapFactory,
}