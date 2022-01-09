const {tokenToRaw} = require("./utils/test_utils");
const testHelpers = require("./utils/test_helpers");
const {deployments} = require("hardhat");
const {resetNetwork} = require("./utils/test_helpers");
const MarketLedger = artifacts.require('MarketLedger')

let token;

contract('MarketLedger LAB TEST', (accounts) => {
    before(async () => {
        await resetNetwork();
        await deployments.fixture(['MarketLedger']);
        const tokenDep = await deployments.get('MarketLedger');
        token = await MarketLedger.at(tokenDep.address);
        await token.transfer(accounts[1], tokenToRaw(1_000_000), {from: accounts[0]})
    });

    // META DATA
    it('Lab', async () => {

    })
})