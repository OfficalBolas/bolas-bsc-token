const BOLAS = artifacts.require('BOLAS')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
const {fees} = require("./config/token_config");
let token;

async function reinitializeTokenNoFees(accounts) {
    token = await BOLAS.new(
        accounts[9], // marketing
    );
    await token.transfer(accounts[1], 10000, {from: accounts[0]})
    await token.excludeMultipleAccountsFromFees([accounts[1], accounts[2], accounts[3], accounts[4]], true, {from: accounts[0]});
}

async function reinitializeTokenWithFees(accounts) {
    token = await BOLAS.new(
        accounts[9], // marketing
    );
    await token.transfer(accounts[1], 10000, {from: accounts[0]})
}

contract('BOLAS FEES TEST', (accounts) => {
    before(async () => {
        await reinitializeTokenWithFees(accounts);
    })

    // CREATION
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assert.strictEqual(balance.toNumber(), 10000)
    })

    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assert.strictEqual(balance.toNumber(), 10000)
    })

    // TRANSFER
    it('transfers: should transfer with fees 10000 to accounts[2] with accounts[1] having 10000', async () => {
        await token.transfer(accounts[2], 10000, {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assert.strictEqual(balance.toNumber(), testHelpers.getTransferAmount(10000, fees))
    })

    it('transfers: balances match after transfer with fees', async () => {
        await reinitializeTokenWithFees(accounts);
        await token.excludeFromReward(accounts[2]);
        await token.transfer(accounts[2], 10000, {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assert.strictEqual(balance.toNumber(), testHelpers.getTransferAmount(10000, fees))
    })

    it('transfers: should transfer with no fees 10000 to accounts[1] with accounts[0] having 10000', async () => {
        await reinitializeTokenWithFees(accounts);
        await token.transfer(accounts[2], 10000, {from: accounts[0]});
        const balance = await token.balanceOf(accounts[2]);
        assert.strictEqual(balance.toNumber(), 10000)
    })
})