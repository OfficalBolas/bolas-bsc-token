const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
const {assertBigNumberEqual, rawToToken} = require("./utils/test_utils");
let token;

contract('BOLAS LAB TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.reinitializeTokenNoFees(accounts);
    });

    // META DATA
    it('creation: should create an initial balance of 10000 for the creator', async () => {
        const balance = await token.balanceOf(accounts[1])
        console.log(balance.toString());
        assertBigNumberEqual(rawToToken(balance), '10000')
    })
})