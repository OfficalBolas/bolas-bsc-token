const testUtils = require("./test_utils");
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')

function getTransferAmount(amount, config) {
    const taxAmount = amount * config.taxFee / 100;
    const liquidityAmount = amount * config.liquidityFee / 100;
    const intermediateAmount = amount - (taxAmount + liquidityAmount);
    const burnAmount = intermediateAmount * config.burnFee / 100;
    const marketingAmount = intermediateAmount * config.marketingFee / 100;
    return intermediateAmount - (burnAmount + marketingAmount);
}

async function getTokenPairOfUniswapFactory(token) {
    return IUniswapV2Pair.at(await token.uniswapV2Pair());
}

async function getTokenReserves(token) {
    const pair = await IUniswapV2Pair.at(await token.uniswapV2Pair());
    const reserves = await pair.getReserves();
    try {
        return [testUtils.fromWei(reserves.reserve1), reserves.reserve0.toNumber()];
    } catch (ex) {
        return [testUtils.fromWei(reserves.reserve0), reserves.reserve1.toNumber()];
    }
}

async function getPriceOfTokenInETH(token) {
    const reserves = await getTokenReserves(token);
    return reserves[0] / reserves[1];
}

module.exports = {
    getTransferAmount,
    getTokenPairOfUniswapFactory,
    getTokenReserves,
    getPriceOfTokenInETH,
}