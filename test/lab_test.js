const {tokenToRaw} = require("./utils/test_utils");
const BOLAS = artifacts.require('BOLAS')
const BOLASDividendTracker = artifacts.require('BOLASDividendTracker')

let token;

contract('BOLAS LAB TEST', (accounts) => {
    // META DATA
    it('Lab', async () => {
        token = await BOLAS.new();
        const dividendTracker = await BOLASDividendTracker.new();
        await dividendTracker.transferOwnership(token.address);
        await token.initialize(dividendTracker.address, {from: accounts[0]});
        await token.excludeMultipleAccountsFromFees([accounts[1], accounts[2], accounts[3], accounts[4]], true, {from: accounts[0]});
        console.log((await token.balanceOf(accounts[0])).toString());
        console.log(tokenToRaw(1000));
        await token.transfer(accounts[1], tokenToRaw(1000), {from: accounts[0]});
    })
})