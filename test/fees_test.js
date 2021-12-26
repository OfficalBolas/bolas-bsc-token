const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
const {fees} = require("./config/token_config");
const {assertBigNumberEqual, tokenToRaw} = require("./utils/test_utils");
let token;

contract('BOLAS FEES TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts);
    })

    // CREATION
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })

    // TRANSFER
    it('transfers: should transfer with fees 10000 to accounts[2] with accounts[1] having 10000', async () => {
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(testHelpers.getTransferAmount(10000, fees)))
    })

    it('transfers: balances match after transfer with fees', async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(testHelpers.getTransferAmount(10000, fees)))
    })

    it('transfers: should transfer with no fees 10000 to accounts[1] with accounts[0] having 10000', async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[0]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })
})