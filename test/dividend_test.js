const BOLAS = artifacts.require('BOLAS')
const IUniswapV2Factory = artifacts.require('IUniswapV2Factory')
const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
const {fees} = require("./config/token_config");
let token;

async function reinitializeTokenWithFees(accounts) {
    token = await BOLAS.new(
        accounts[9], // marketing
    );
    await token.transfer(accounts[1], 100000000, {from: accounts[0]})
}

contract('BOLAS DIVIDEND TEST', (accounts) => {
    before(async () => {
        await reinitializeTokenWithFees(accounts);
    });

    // CREATION
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assert.strictEqual(balance.toNumber(), 100000000)
        const totalFees = await token.totalFees();
        assert.strictEqual(totalFees.toNumber(), 0);
    });

    // TRANSFER
    it('transfers: should transfer with fees 10000 to accounts[2] with accounts[1] having 10000', async () => {
        await token.transfer(accounts[2], 10000, {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assert.strictEqual(balance.toNumber(), testHelpers.getTransferAmount(10000, fees))
    });
})