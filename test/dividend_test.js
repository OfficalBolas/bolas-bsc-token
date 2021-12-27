const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
const {fees, slippageTolerance} = require("./config/token_config");
const {assertBigNumberEqual, tokenToRaw} = require("./utils/test_utils");
let token;

contract('BOLAS DIVIDEND TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts, 100000000);
    });

    // CREATION
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(balance, tokenToRaw(100000000))
    });
})