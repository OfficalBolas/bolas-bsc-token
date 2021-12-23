const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
let token;

contract('BOLAS SWAP TEST', (accounts) => {
    it('Uniswap exists', async () => {
        const uniswapRouter = await IUniswapV2Router02.at('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
        const factory = await IUniswapV2Factory.at(await uniswapRouter.factory());
        assert.strictEqual(factory.address, '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f');
    })
})