const testUtils = require("./test_utils");
const {tokenToRaw, rawToToken, getETHToTokenPath} = require("./test_utils");
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const BOLAS = artifacts.require('BOLAS');

async function reinitializeTokenNoFees(accounts, account1Balance = 10000) {
    const token = await BOLAS.new();
    await token.initialize();
    await token.transfer(accounts[1], tokenToRaw(account1Balance), {from: accounts[0]})
    await token.excludeMultipleAccountsFromFees([accounts[1], accounts[2], accounts[3], accounts[4]], true, {from: accounts[0]});
    return token;
}

async function reinitializeTokenWithFees(accounts, account1Balance = 10000) {
    const token = await BOLAS.new();
    await token.initialize();
    await token.transfer(accounts[1], tokenToRaw(account1Balance), {from: accounts[0]})
    return token;
}

function getTransferAmount(amount, config) {
    const taxAmount = amount * config.taxFee / 100;
    const liquidityAmount = amount * config.liquidityFee / 100;
    const burnAmount = amount * config.burnFee / 100;
    const marketingAmount = amount * config.marketingFee / 100;
    return amount - (burnAmount + marketingAmount + taxAmount + liquidityAmount);
}

async function getTokenPairOfUniswapFactory(token) {
    return IUniswapV2Pair.at(await token.uniswapV2Pair());
}

async function getTokenReserves(token) {
    const pair = await IUniswapV2Pair.at(await token.uniswapV2Pair());
    const reserves = await pair.getReserves();
    try {
        return [testUtils.fromWei(reserves.reserve0), rawToToken(reserves.reserve1)];
    } catch (ex) {
        return [testUtils.fromWei(reserves.reserve1), rawToToken(reserves.reserve0)];
    }
}

async function getPriceOfTokenInETH(token) {
    return 1 / (await getTokenAmountForETH(token, 1));
}

async function getTokenAmountForETH(token, ethMount) {
    const router = await IUniswapV2Router02.at(await token.uniswapV2Router());
    const tokenRawAmount = await router.getAmountsOut(ethMount, await getETHToTokenPath(token, router));
    return tokenRawAmount[1];
}

module.exports = {
    getTransferAmount,
    getTokenPairOfUniswapFactory,
    getTokenReserves,
    getPriceOfTokenInETH,
    reinitializeTokenNoFees,
    reinitializeTokenWithFees,
    getTokenAmountForETH,
}