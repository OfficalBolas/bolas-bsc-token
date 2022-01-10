const testUtils = require('../test/utils/test_utils');
const testHelpers = require('../test/utils/test_helpers');
const {assertBigNumberEqual, rawToToken} = require("../test/utils/test_utils");
let token;

contract('PRODUCTION TEST', (accounts) => {
    before(async () => {
        token = await testHelpers.initializeWithDeployedToken(accounts);
    });

    // META DATA
    it('creation: should create an initial balance of 10000 for the creator', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(rawToToken(balance), '10000')
    })
})