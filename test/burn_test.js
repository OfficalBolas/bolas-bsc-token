let token;
const BOLAS = artifacts.require('BOLAS')

async function reinitializeTokenNoFees(accounts) {
    token = await BOLAS.new();
    await token.transfer(accounts[1], 10000, {from: accounts[0]})
    await token.excludeMultipleAccountsFromFees([accounts[1], accounts[2], accounts[3], accounts[4]], true, {from: accounts[0]});
}

async function reinitializeTokenWithFees(accounts) {
    token = await BOLAS.new();
    await token.transfer(accounts[1], 10000, {from: accounts[0]})
}

contract('BOLAS BURN TEST', (accounts) => {
    before(async () => {
        await reinitializeTokenNoFees(accounts);
    })

    it('creation: should create an initial balance of 10000 for the creator', async () => {
        const balance = await token.balanceOf(accounts[1])
        assert.strictEqual(balance.toNumber(), 10000)
    })
})