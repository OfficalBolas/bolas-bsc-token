const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
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
        const router = await token.uniswapV2Router();
        const totalSupply = await token.totalSupply();
        await token.approve(router, totalSupply, {from: accounts[0]});
        const allowance = await token.allowance(accounts[0], router);
        assert.strictEqual(allowance.toString(), totalSupply.toString());
    });
})