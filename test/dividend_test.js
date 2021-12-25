const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
const {fees, slippageTolerance} = require("./config/token_config");
let token;

async function reinitializeTokenWithFees(accounts) {
    token = await BOLAS.new(
        accounts[9], // marketing
    );
    await token.transfer(accounts[1], 100000000, {from: accounts[0]})
}

contract('BOLAS DIVIDEND TEST', (accounts) => {
    before(async () => {
        await reinitializeTokenWithFees(accounts);
    });

    // CREATION
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assert.strictEqual(balance.toNumber(), 100000000)
        const totalFees = await token.totalFees();
        assert.strictEqual(totalFees.toNumber(), 0);
    });

    // SETUP SWAP
    it('Uniswap router is approved for the maximum amount', async () => {
        const routerAddress = await token.uniswapV2Router();
        const totalSupply = await token.totalSupply();
        await token.approve(routerAddress, totalSupply, {from: accounts[1]});
        const allowance = await token.allowance(accounts[1], routerAddress);
        assert.strictEqual(allowance.toString(), totalSupply.toString());
    });

    it('Add liquidity to Uniswap router', async () => {
        const LIQUIDITY_ETH_AMOUNT = 100;
        const LIQUIDITY_TOKEN_AMOUNT = 50000000;
        const prevTokenBalance = await token.balanceOf(accounts[1])
        const prevETHBalance = await testUtils.getEthBalance(accounts[1])
        const routerAddress = await token.uniswapV2Router();
        const router = await IUniswapV2Router02.at(routerAddress);
        await router.addLiquidityETH(
            token.address, LIQUIDITY_TOKEN_AMOUNT, 0, 0, accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1], value: testUtils.toWei(LIQUIDITY_ETH_AMOUNT)});
        const newTokenBalance = await token.balanceOf(accounts[1]);
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        assert.strictEqual(prevTokenBalance.toNumber(), LIQUIDITY_TOKEN_AMOUNT + newTokenBalance.toNumber());
        const ethBalanceDiff = parseFloat(testUtils.fromWei(newETHBalance)) - parseFloat(testUtils.fromWei(prevETHBalance));
        console.log(`LIQUIDITY ADDING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`LIQUIDITY ADDING FEE: ETH ${ethBalanceDiff + LIQUIDITY_ETH_AMOUNT}`);
        assert(ethBalanceDiff < -LIQUIDITY_ETH_AMOUNT);
    });

    // TRANSFER
    it('transfers: should transfer with fees 10000 to accounts[2] with accounts[1] having 10000', async () => {
        await token.transfer(accounts[2], 10000, {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assert.strictEqual(balance.toNumber(), testHelpers.getTransferAmount(10000, fees))
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
            SWAP_TOKEN_AMOUNT, 0, await testUtils.getTokenToETHPath(token, router), accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1]});
        const newTokenBalance = await token.balanceOf(accounts[1]);
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        const ethBalanceDiff = parseFloat(testUtils.fromWei(newETHBalance)) - parseFloat(testUtils.fromWei(prevETHBalance));
        const tokenBalanceDiff = newTokenBalance.toNumber() - prevTokenBalance.toNumber();
        const slippage = (1 - ethBalanceDiff / estETHOutput) * 100;
        console.log(`ESTIMATED OUTPUT: ETH ${estETHOutput}`);
        console.log(`SWAPPING BALANCE CHANGE: BOLAS ${tokenBalanceDiff}`);
        console.log(`SWAPPING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`SWAPPING SLIPPAGE: ${slippage}%`);
        assert(slippage > slippageTolerance.minSellSlippage && slippage < slippageTolerance.maxSellSlippage);
    });
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[2])
        assert.strictEqual(balance.toNumber(), testHelpers.getTransferAmount(10000, fees))
    });
    it('Check total fee accumulated', async () => {
        const totalFee = await token.totalFees()
        assert.strictEqual(totalFee.toNumber(), 1424713);
    });
})