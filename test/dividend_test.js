const BOLAS = artifacts.require('BOLAS')
const BOLASDividendTracker = artifacts.require('BOLASDividendTracker');
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testHelpers = require('./utils/test_helpers');
const {fees, slippageTolerance} = require("./config/token_config");
const {assertBigNumberEqual, tokenToRaw, rawToToken, rawToTokenNumber, getEthBalance} = require("./utils/test_utils");
let token;
let dividendTracker;

contract('BOLAS DIVIDEND TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts, 100_000_000);
        await testHelpers.setupLiquidity(token, accounts);
        dividendTracker = await BOLASDividendTracker.at(await token.dividendTracker())
    });

    // Dividend tracker tests
    it('account[0] should be ignored from dividends, and account[1] should not be', async () => {
        const account0Excluded = await token.isExcludedFromDividends(accounts[0])
        const account1Excluded = await token.isExcludedFromDividends(accounts[1])
        assert.equal(account0Excluded, true);
        assert.equal(account1Excluded, false);
    });
    it('should create an initial balance of 100000000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(balance, tokenToRaw(100_000_000))
    });
    it('should have correct minimumTokenBalanceForDividends', async () => {
        const minBalance = await dividendTracker.minimumTokenBalanceForDividends()
        assertBigNumberEqual(minBalance, tokenToRaw(1_000_000))
    });

    // Dividend tests before any swap
    it('Total token holders should be 1', async () => {
        const holderCount = await token.getNumberOfDividendTokenHolders()
        assertBigNumberEqual(holderCount, 1)
    });
    it('Total token holders should be 2 after another transfer', async () => {
        await token.transfer(accounts[2], tokenToRaw(5_000_000), {from: accounts[0]})
        const holderCount = await token.getNumberOfDividendTokenHolders()
        assertBigNumberEqual(holderCount, 2)
    });
    it('Total dividends ETH distributed should be 0 because no swap yet', async () => {
        const totalDistributed = await token.getTotalDividendsDistributed()
        assertBigNumberEqual(totalDistributed, 0)
    });
    it('account[1] withdrawable dividend should be 0 because no swap yet', async () => {
        const withdrawableDividends = await token.withdrawableDividendOf(accounts[1])
        assertBigNumberEqual(withdrawableDividends, 0)
    });

    // Dividends tests after swap
    it('Buying tokens for 10ETH should work', async () => {
        await testHelpers.buyTokens(token, 10, accounts[2]);
        const balance = await token.balanceOf(accounts[2])
        const balanceInTokens = rawToTokenNumber(balance);
        assert(balanceInTokens > 8_000_000 && balanceInTokens < 10_000_000);
    });
    it('Selling 4,000,000 tokens for ETH should work', async () => {
        await testHelpers.sellTokens(token, 4_000_000, accounts[2]);
        const balance = await token.balanceOf(accounts[2])
        const balanceInTokens = rawToTokenNumber(balance);
        assert(balanceInTokens > 4_000_000 && balanceInTokens < 6_000_000);
    });
})