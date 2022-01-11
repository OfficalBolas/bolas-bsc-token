const testUtils = require("./test_utils");
const {tokenToRaw, rawToToken, getETHToTokenPath} = require("./test_utils");
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const BOLAS = artifacts.require('BOLAS');
const BOLASDividendTracker = artifacts.require('BOLASDividendTracker');
const {deployments, network, getNamedAccounts} = require('hardhat');
const {forking} = require("../config/network_config");

async function resetNetwork() {
    if (network.name !== 'hardhat') return;
    await network.provider.request({
        method: "hardhat_reset",
        params: [{forking: {jsonRpcUrl: forking.url, blockNumber: forking.blockNumber}},],
    });
}

async function initializeWithDeployedToken(accounts, account1Balance = 10000) {
    const tokenDep = await deployments.get('BOLAS');
    const token = await BOLAS.at(tokenDep.address);
    await token.transfer(accounts[1], tokenToRaw(account1Balance), {from: accounts[0]})
    return token;
}

async function reinitializeTokenNoFees(accounts, account1Balance = 10000) {
    await resetNetwork();
    await deployments.fixture(['BOLAS']);
    const tokenDep = await deployments.get('BOLAS');
    const token = await BOLAS.at(tokenDep.address);
    await token.excludeMultipleAccountsFromFees([accounts[1], accounts[2], accounts[3], accounts[4]], true, {from: accounts[0]});
    await token.transfer(accounts[1], tokenToRaw(account1Balance), {from: accounts[0]})
    await token.activate();
    return token;
}

async function reinitializeTokenWithFees(accounts, account1Balance = 10000) {
    await resetNetwork();
    await deployments.fixture(['BOLAS']);
    const tokenDep = await deployments.get('BOLAS');
    const token = await BOLAS.at(tokenDep.address);
    await token.transfer(accounts[1], tokenToRaw(account1Balance), {from: accounts[0]})
    await token.activate();
    return token;
}

async function setupLiquidity(token, accounts, liquidityETHAmount = 100, liquidityTokenAmount = 50_000_000_000) {
    const {liquidityWallet} = await getNamedAccounts();
    const routerAddress = await token.uniswapV2Router();
    const totalSupply = await token.totalSupply();
    await token.approve(routerAddress, totalSupply, {from: accounts[0]});
    const router = await IUniswapV2Router02.at(routerAddress);
    await router.addLiquidityETH(
        token.address, tokenToRaw(liquidityTokenAmount), 0, 0, liquidityWallet, new Date().getTime() + 3600000,
        {from: accounts[0], value: testUtils.toWei(liquidityETHAmount)});
}

async function buyTokens(token, ethAmount, account) {
    const routerAddress = await token.uniswapV2Router();
    const router = await IUniswapV2Router02.at(routerAddress);
    await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0, await testUtils.getETHToTokenPath(token, router), account, new Date().getTime() + 3600000,
        {from: account, value: testUtils.toWei(ethAmount)});
}

async function sellTokens(token, tokenAmount, account) {
    const routerAddress = await token.uniswapV2Router();
    const router = await IUniswapV2Router02.at(routerAddress);
    await token.approve(routerAddress, tokenToRaw(tokenAmount), {from: account});
    await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        tokenToRaw(tokenAmount), 0, await testUtils.getTokenToETHPath(token, router), account, new Date().getTime() + 3600000,
        {from: account});
}

function getTransferAmount(amount, config) {
    const taxAmount = amount * config.dividendFee / 100;
    const liquidityAmount = amount * config.liquidityFee / 100;
    const burnAmount = amount * config.burnFee / 100;
    const marketingAmount = amount * config.marketingFee / 100;
    const appAmount = amount * config.appFees.reduce((a, b) => a + b, 0) / 100;
    return amount - (burnAmount + marketingAmount + taxAmount + liquidityAmount + appAmount);
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
    resetNetwork,
    getTransferAmount,
    getTokenPairOfUniswapFactory,
    getTokenReserves,
    getPriceOfTokenInETH,
    reinitializeTokenNoFees,
    reinitializeTokenWithFees,
    initializeWithDeployedToken,
    getTokenAmountForETH,
    setupLiquidity,
    buyTokens,
    sellTokens,
}