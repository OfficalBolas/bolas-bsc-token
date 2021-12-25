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
    await token.transfer(accounts[1], 100000000, {from: accounts[0]})
}

contract('BOLAS SWAP TEST', (accounts) => {
    const minBuySlippage = 13;
    const maxBuySlippage = 15;
    const minSellSlippage = 13;
    const maxSellSlippage = 19;
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
    it('Get uniswap reserves', async () => {
        const reserves = await testHelpers.getTokenReserves(token);
        const priceInETH = await testHelpers.getPriceOfTokenInETH(token);
        console.log(`ETH vs BOLAS reserves: ${reserves[0]} vs ${reserves[1]}`);
        console.log(`Price in ETH ${priceInETH}`);
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
        const tokenBalanceDiff = newTokenBalance.toNumber() - prevTokenBalance.toNumber();
        const slippage = (1 - tokenBalanceDiff / estTokenOutput) * 100;
        console.log(`ESTIMATED OUTPUT: BOLAS ${estTokenOutput}`);
        console.log(`SWAPPING BALANCE CHANGE: BOLAS ${tokenBalanceDiff}`);
        console.log(`SWAPPING BALANCE CHANGE: ETH ${ethBalanceDiff}`);
        console.log(`SWAPPING SLIPPAGE: ${slippage}%`);
        console.log(`SWAPPING FEE: ETH ${ethBalanceDiff + SWAP_ETH_AMOUNT}`);
        assert(ethBalanceDiff < -SWAP_ETH_AMOUNT);
        assert(slippage > minBuySlippage && slippage < maxBuySlippage);
    });
    it('Sell tokens from uniswap', async () => {
        const SWAP_TOKEN_AMOUNT = 1855010;
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
        assert(slippage > minSellSlippage && slippage < maxSellSlippage);
    });
})