const BOLAS = artifacts.require('BOLAS')
const BOLASDividendTracker = artifacts.require('BOLASDividendTracker');
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testHelpers = require('./utils/test_helpers');
const {fees, slippageTolerance} = require("./config/token_config");
const {assertBigNumberEqual, tokenToRaw} = require("./utils/test_utils");
let token;
let dividendTracker;

contract('BOLAS DIVIDEND TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts, 100000000);
        await testHelpers.setupLiquidity(token, accounts);
        dividendTracker = await BOLASDividendTracker.at(await token.dividendTracker())
    });

    // CREATION
    it('should create an initial balance of 50000000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(balance, tokenToRaw(50000000))
    });
    it('should have correct minimumTokenBalanceForDividends', async () => {
        const minBalance = await dividendTracker.minimumTokenBalanceForDividends()
        assertBigNumberEqual(minBalance, tokenToRaw(1000))
    });
    it('Total token holders should be 1', async () => {
        const holderCount = await token.getNumberOfDividendTokenHolders()
        assertBigNumberEqual(holderCount, 1)
    });
    it('Total token holders should be 2 after another transfer', async () => {
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[0]})
        const holderCount = await token.getNumberOfDividendTokenHolders()
        assertBigNumberEqual(holderCount, 2)
    });
})