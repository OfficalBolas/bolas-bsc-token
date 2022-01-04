const testUtils = require("./test_utils");
const {tokenToRaw, rawToToken, getETHToTokenPath} = require("./test_utils");
const Big = require("big.js");
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const BOLAS = artifacts.require('BOLAS');
const BOLASDividendTracker = artifacts.require('BOLASDividendTracker');

async function reinitializeTokenNoFees(accounts, account1Balance = 10000) {
    const token = await BOLAS.new();
    const dividendTracker = await BOLASDividendTracker.new();
    await dividendTracker.transferOwnership(token.address);
    await token.initialize(dividendTracker.address);
    await token.excludeMultipleAccountsFromFees([accounts[1], accounts[2], accounts[3], accounts[4]], true, {from: accounts[0]});
    await token.transfer(accounts[1], tokenToRaw(account1Balance), {from: accounts[0]})
    return token;
}

async function reinitializeTokenWithFees(accounts, account1Balance = 10000) {
    const token = await BOLAS.new();
    const dividendTracker = await BOLASDividendTracker.new();
    await dividendTracker.transferOwnership(token.address);
    await token.initialize(dividendTracker.address);
    await token.transfer(accounts[1], tokenToRaw(account1Balance), {from: accounts[0]})
    return token;
}

async function setupLiquidity(token, accounts, liquidityETHAmount = 100, liquidityTokenAmount = 50000000) {
    const routerAddress = await token.uniswapV2Router();
    const totalSupply = await token.totalSupply();
    await token.approve(routerAddress, totalSupply, {from: accounts[1]});
    const router = await IUniswapV2Router02.at(routerAddress);
    await router.addLiquidityETH(
        token.address, tokenToRaw(liquidityTokenAmount), 0, 0, accounts[1], new Date().getTime() + 3600000,
        {from: accounts[1], value: testUtils.toWei(liquidityETHAmount)});
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
    setupLiquidity,
}