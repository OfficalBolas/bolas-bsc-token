const testUtils = require('./helpers/test_utils');
const testHelpers = require('./helpers/test_helpers');
const {assertBigNumberEqual, rawToToken} = require("./helpers/test_utils");
let token;

contract('BOLAS LAB TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeToken(accounts);
    });

    // META DATA
    it('creation: should create an initial balance of 10000 for the creator', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(rawToToken(balance), '10000')
    })
})