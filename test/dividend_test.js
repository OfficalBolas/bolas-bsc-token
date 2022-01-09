const BOLAS = artifacts.require('BOLAS')
const BOLASDividendTracker = artifacts.require('BOLASDividendTracker');
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testHelpers = require('./utils/test_helpers');
const {fees, slippageTolerance} = require("./config/token_config");
const {
    assertBigNumberEqual,
    tokenToRaw,
    rawToToken,
    rawToTokenNumber,
    getEthBalance,
    assertBigNumberGt, assertBigNumberLt, fromWei
} = require("./utils/test_utils");
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

    // Doing swaps to create dividends
    it('Buying tokens for 0.3 ETH should work', async () => {
        await testHelpers.buyTokens(token, 0.3, accounts[2]);
        const balance = await token.balanceOf(accounts[2])
        const balanceInTokens = rawToTokenNumber(balance);
        assert(balanceInTokens > 120_000_000 && balanceInTokens < 150_000_000, `${balanceInTokens} is not in the correct range`);
    });
    it('Selling 80,000,000 tokens for ETH should work', async () => {
        await testHelpers.sellTokens(token, 80_000_000, accounts[2]);
        const balance = await token.balanceOf(accounts[2])
        const balanceInTokens = rawToTokenNumber(balance);
        assert(balanceInTokens > 40_000_000 && balanceInTokens < 70_000_000, `${balanceInTokens} is not in the correct range`);
    });

    // Dividend tests after swaps
    it('Total token holders should be still 2 after swaps', async () => {
        await token.transfer(accounts[2], tokenToRaw(5_000_000), {from: accounts[0]})
        const holderCount = await token.getNumberOfDividendTokenHolders()
        assertBigNumberEqual(holderCount, 2)
    });
    it('Total dividends ETH distributed should be above zero after swaps', async () => {
        const totalDistributed = await token.getTotalDividendsDistributed();
        assertBigNumberGt(totalDistributed, '8000000000000000');
        assertBigNumberLt(totalDistributed, '12000000000000000');
    });
    it('account[1] withdrawable dividend should be 0 because its already distributed', async () => {
        const withdrawableDividends = await token.withdrawableDividendOf(accounts[1])
        assertBigNumberEqual(withdrawableDividends, '0');
    });
})