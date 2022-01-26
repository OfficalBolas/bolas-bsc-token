const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testUtils = require('./helpers/test_utils');
const testHelpers = require('./helpers/test_helpers');
const {slippageTolerance} = require("../config/token_config");
const {
    assertBigNumberEqual,
    tokenToRaw,
    rawToToken,
    assertBigNumberGt,
    assertBigNumberLt, rawToTokenNumber, assertFailure
} = require("./helpers/test_utils");
const Big = require("big.js");
let token;

contract('BOLAS LOCK TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeToken(accounts, 10_000, false);
        await testHelpers.setupLiquidity(token, accounts);
    });

    it('Buying tokens for 0.3 ETH should work', async () => {
        await testHelpers.buyTokens(token, 0.3, accounts[0]);
        const balance = await token.balanceOf(accounts[0])
        assert.ok(balance);
    });

    it('Selling 80,000,000 tokens for ETH should work', async () => {
        await testHelpers.sellTokens(token, 80_000_000, accounts[0]);
        const balance = await token.balanceOf(accounts[0])
        assert.ok(balance);
    });

    it('Buying tokens for 0.3 ETH should fail from non owner account', async () => {
        await assertFailure(() => testHelpers.buyTokens(token, 0.3, accounts[1]));
    });

    it('Selling 80,000,000 tokens for ETH should fail from non owner account', async () => {
        await assertFailure(() => testHelpers.sellTokens(token, 80_000_000, accounts[1]));
    });

    it('Token ownership is transfered to account[1]', async () => {
        await token.transferOwnership(accounts[1], {from: accounts[0]});
        const owner = await token.owner();
        assert.strictEqual(owner, accounts[1]);
    });

    it('Buying tokens for 0.3 ETH should work', async () => {
        await testHelpers.buyTokens(token, 0.3, accounts[1]);
        const balance = await token.balanceOf(accounts[1])
        assert.ok(balance);
    });

    it('Selling 80,000,000 tokens for ETH should work', async () => {
        await testHelpers.sellTokens(token, 80_000_000, accounts[1]);
        const balance = await token.balanceOf(accounts[1])
        assert.ok(balance);
    });
})