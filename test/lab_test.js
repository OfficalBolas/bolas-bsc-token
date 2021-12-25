const BOLAS = artifacts.require('BOLAS')
const testUtils = require('./utils/test_utils');
const testHelpers = require('./utils/test_helpers');
let token;

async function reinitializeTokenWithFees(accounts) {
    token = await BOLAS.new(
        accounts[9], // charity
    );
    await token.transfer(accounts[1], 10000, {from: accounts[0]})
}

contract('BOLAS SWAP TEST', (accounts) => {
    before(async () => {
        await reinitializeTokenWithFees(accounts);
    });

    it('Uniswap router exists', async () => {
        console.log(testUtils.getMinimumAmountWithSlippage(1000, 10));
    });
})