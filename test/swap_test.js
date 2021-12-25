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
        const prevTokenBalance = await token.balanceOf(accounts[1])
        const prevETHBalance = await testUtils.getEthBalance(accounts[1])
        const routerAddress = await token.uniswapV2Router();
        const router = await IUniswapV2Router02.at(routerAddress);
        await router.addLiquidityETH(
            token.address, 5000, 0, 0, accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1], value: testUtils.toWei('2')});
        const newTokenBalance = await token.balanceOf(accounts[1]);
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        assert.strictEqual(prevTokenBalance.toNumber(), 5000 + newTokenBalance.toNumber());
        assert.strictEqual(
            parseFloat(testUtils.fromWei(prevETHBalance)),
            2 + parseFloat(testUtils.fromWei(newETHBalance)),
        );
    });

    it('Buy tokens from uniswap', async () => {
        const prevTokenBalance = await token.balanceOf(accounts[1])
        const prevETHBalance = await testUtils.getEthBalance(accounts[1])
        const routerAddress = await token.uniswapV2Router();
        const router = await IUniswapV2Router02.at(routerAddress);
        await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0, await testUtils.getETHToTokenPath(token, router), accounts[1], new Date().getTime() + 3600000,
            {from: accounts[1], value: testUtils.toWei('1')});
        const newTokenBalance = await token.balanceOf(accounts[1]);
        const newETHBalance = await testUtils.getEthBalance(accounts[1])
        assert.strictEqual(6246, newTokenBalance.toNumber());
        assert.strictEqual(
            parseFloat(testUtils.fromWei(prevETHBalance)),
            1 + parseFloat(testUtils.fromWei(newETHBalance)),
        );
    });
})