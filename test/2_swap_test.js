const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
const {slippageTolerance} = require("./config/token_config");
const {
    assertBigNumberEqual,
    tokenToRaw,
    rawToToken,
    assertBigNumberGt,
    assertBigNumberLt
} = require("./utils/test_utils");
const Big = require("big.js");
let token;

contract('BOLAS SWAP TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts, 100000000);
    });

    it('Uniswap router exists', async () => {
        const router = await token.uniswapV2Router();
        assert.strictEqual(router, '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
    });

    it('Uniswap router is approved for the maximum amount', async () => {
        const routerAddress = await token.uniswapV2Router();
        const totalSupply = await token.totalSupply();
        await token.approve(routerAddress, totalSupply, {from: accounts[1]});
        const allowance = await token.allowance(accounts[1], routerAddress);
        assertBigNumberEqual(allowance, totalSupply);
    });

    it('Add liquidity to Uniswap router', async () => {
        const LIQUIDITY_ETH_AMOUNT = 100;
        const LIQUIDITY_TOKEN_AMOUNT = 50000000;
        const prevETHBalance = await testUtils.getEthBalance(accounts[1])
        const routerAddress = await token.uniswapV2Router();
        const router = await IUniswapV2Router02.at(routerAddress);
        await router.addLiquidityETH(
            token.address, tokenToRaw(LIQUIDITY_TOKEN_AMOUNT), 0, 0, accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1], value: testUtils.toWei(LIQUIDITY_ETH_AMOUNT)});
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        const ethBalanceDiff = parseFloat(testUtils.fromWei(newETHBalance)) - parseFloat(testUtils.fromWei(prevETHBalance));
        console.log(`LIQUIDITY ADDING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`LIQUIDITY ADDING FEE: ETH ${ethBalanceDiff + LIQUIDITY_ETH_AMOUNT}`);
        assert(ethBalanceDiff < -LIQUIDITY_ETH_AMOUNT);
    });
    it('Get amount of tokens getting for 1ETH', async () => {
        const tokenAmountForETH = await testHelpers.getTokenAmountForETH(token, 1);
        console.log(`Estimated quotation is 1ETH = ${tokenAmountForETH}BOLAS`);
        assert.ok(tokenAmountForETH);
    });
    it('Get token price in ETH', async () => {
        const priceInETH = await testHelpers.getPriceOfTokenInETH(token);
        console.log(`Price in ETH: ${priceInETH}`);
        assert.ok(priceInETH);
    });
    it('Buy tokens from uniswap', async () => {
        const SWAP_ETH_AMOUNT = 0.1;
        const priceInETH = await testHelpers.getPriceOfTokenInETH(token);
        const estTokenOutput = SWAP_ETH_AMOUNT / priceInETH;
        const prevTokenBalance = await token.balanceOf(accounts[1])
        const prevETHBalance = await testUtils.getEthBalance(accounts[1])
        const routerAddress = await token.uniswapV2Router();
        const router = await IUniswapV2Router02.at(routerAddress);
        await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0, await testUtils.getETHToTokenPath(token, router), accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1], value: testUtils.toWei(SWAP_ETH_AMOUNT)});
        const newTokenBalance = await token.balanceOf(accounts[1]);
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        const ethBalanceDiff = parseFloat(testUtils.fromWei(newETHBalance)) - parseFloat(testUtils.fromWei(prevETHBalance));
        const tokenBalanceDiff = rawToToken(newTokenBalance) - rawToToken(prevTokenBalance);
        const slippage = (1 - tokenBalanceDiff / estTokenOutput) * 100;
        console.log(`ESTIMATED OUTPUT: BOLAS ${estTokenOutput}`);
        console.log(`SWAPPING BALANCE CHANGE: BOLAS ${tokenBalanceDiff}`);
        console.log(`SWAPPING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`SWAPPING SLIPPAGE: ${slippage}%`);
        console.log(`SWAPPING FEE: ETH ${ethBalanceDiff + SWAP_ETH_AMOUNT}`);
        assert(ethBalanceDiff < -SWAP_ETH_AMOUNT);
        assert(slippage > slippageTolerance.minBuySlippage && slippage < slippageTolerance.maxBuySlippage);
    });
    it('Sell tokens from uniswap', async () => {
        const SWAP_TOKEN_AMOUNT = 1055010;
        const priceInETH = await testHelpers.getPriceOfTokenInETH(token);
        const estETHOutput = SWAP_TOKEN_AMOUNT * priceInETH;
        const prevTokenBalance = await token.balanceOf(accounts[1])
        const prevETHBalance = await testUtils.getEthBalance(accounts[1])
        const routerAddress = await token.uniswapV2Router();
        const router = await IUniswapV2Router02.at(routerAddress);
        await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenToRaw(SWAP_TOKEN_AMOUNT), 0, await testUtils.getTokenToETHPath(token, router), accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1]});
        const newTokenBalance = await token.balanceOf(accounts[1]);
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        const ethBalanceDiff = parseFloat(testUtils.fromWei(newETHBalance)) - parseFloat(testUtils.fromWei(prevETHBalance));
        const tokenBalanceDiff = rawToToken(newTokenBalance) - rawToToken(prevTokenBalance);
        const slippage = (1 - ethBalanceDiff / estETHOutput) * 100;
        console.log(`ESTIMATED OUTPUT: ETH ${estETHOutput}`);
        console.log(`SWAPPING BALANCE CHANGE: BOLAS ${tokenBalanceDiff}`);
        console.log(`SWAPPING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`SWAPPING SLIPPAGE: ${slippage}%`);
        assert(slippage > slippageTolerance.minSellSlippage && slippage < slippageTolerance.maxSellSlippage);
    });

    // total supply & burnt
    it('total supply: total supply should be reduced after burns', async () => {
        const totalSupply = await token.totalSupply();
        assertBigNumberGt(totalSupply, '150000000000000000000000000000000');
        assertBigNumberLt(totalSupply, '170000000000000000000000000000000');
    });
    it('total burnt: total burnt should be reduced after burns', async () => {
        const totalBurnt = await token.totalBurnt();
        assertBigNumberGt(totalBurnt, '2900000000000000000000000');
        assertBigNumberLt(totalBurnt, '3100000000000000000000000');
    });
})