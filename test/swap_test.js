const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
let token;

async function reinitializeTokenWithFees(accounts) {
    token = await BOLAS.new(
        accounts[9], // charity
    );
    await token.transfer(accounts[1], 10000, {from: accounts[0]})
}

contract('BOLAS SWAP TEST', (accounts) => {
    before(async () => {
        await reinitializeTokenWithFees(accounts);
    });

    it('Uniswap router exists', async () => {
        const router = await token.uniswapV2Router();
        assert.strictEqual(router, '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
    });

    it('Uniswap router is approved for the maximum amount', async () => {
        const routerAddress = await token.uniswapV2Router();
        const totalSupply = await token.totalSupply();
        await token.approve(routerAddress, totalSupply, {from: accounts[1]});
        const pair = await IUniswapV2Pair.at(await token.uniswapV2Pair());
        await pair.approve(routerAddress, totalSupply, {from: accounts[1]});
        const allowance = await token.allowance(accounts[1], routerAddress);
        assert.strictEqual(allowance.toString(), totalSupply.toString());
    });

    it('Add liquidity to Uniswap router', async () => {
        const LIQUIDITY_ETH_AMOUNT = 2;
        const prevTokenBalance = await token.balanceOf(accounts[1])
        const prevETHBalance = await testUtils.getEthBalance(accounts[1])
        const routerAddress = await token.uniswapV2Router();
        const router = await IUniswapV2Router02.at(routerAddress);
        await router.addLiquidityETH(
            token.address, 5000, 0, 0, accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1], value: testUtils.toWei(LIQUIDITY_ETH_AMOUNT)});
        const newTokenBalance = await token.balanceOf(accounts[1]);
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        assert.strictEqual(prevTokenBalance.toNumber(), 5000 + newTokenBalance.toNumber());
        const ethBalanceDiff = parseFloat(testUtils.fromWei(newETHBalance)) - parseFloat(testUtils.fromWei(prevETHBalance));
        console.log(`LIQUIDITY ADDING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`LIQUIDITY ADDING FEE: ETH ${ethBalanceDiff + LIQUIDITY_ETH_AMOUNT}`);
        assert(ethBalanceDiff < -LIQUIDITY_ETH_AMOUNT);
    });

    it('Buy tokens from uniswap', async () => {
        const SWAP_ETH_AMOUNT = 1;
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
        const tokenBalanceDiff = newTokenBalance.toNumber() - prevTokenBalance.toNumber();
        console.log(`SWAPPING BALANCE CHANGE: BOLAS ${tokenBalanceDiff}`);
        console.log(`SWAPPING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`SWAPPING FEE: ETH ${ethBalanceDiff + SWAP_ETH_AMOUNT}`);
        assert(ethBalanceDiff < -SWAP_ETH_AMOUNT);
    });
})