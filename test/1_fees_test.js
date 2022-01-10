const testHelpers = require('./utils/test_helpers');
const {fees} = require("./config/token_config");
const {assertBigNumberEqual, tokenToRaw, percentToRaw, getEthBalance} = require("./utils/test_utils");
const {getNamedAccounts} = require("hardhat");
let namedAccounts;
let token;

contract('BOLAS FEES TEST', (accounts) => {
    before(async () => {
        namedAccounts = await getNamedAccounts();
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

    it('transfers: should transfer with no fees 10000 to accounts[1] with accounts[0] having 10000', async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[0]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })

    it('transfers: balances match after transfer with fees', async () => {
        token = await testHelpers.reinitializeTokenWithFees(accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(testHelpers.getTransferAmount(10000, fees)))
    })

    // total supply & burnt
    it('total supply: total supply should be reduced after burns', async () => {
        const totalSupply = await token.totalSupply();
        assertBigNumberEqual(totalSupply, '159999999999400000000000000000000');
    });
    it('total burnt: total burnt should be reduced after burns', async () => {
        const totalBurnt = await token.totalBurnt();
        assertBigNumberEqual(totalBurnt, '600000000000000000000');
    });

    // Isolated fees
    it('isolated fees: app taxes should be correctly initialized', async () => {
        const appTaxList = await token.taxApps();
        for (let i = 0; i < 6; i++) {
            assertBigNumberEqual(appTaxList[i], percentToRaw(fees.appFees[i]));
        }
    });
    it('isolated fees: should change single app tax slot', async () => {
        const percentToSet = 5;
        await token.setTaxApps(2, percentToRaw(percentToSet))
        const appTax = await token.taxAppOf(2);
        assertBigNumberEqual(appTax, percentToRaw(percentToSet));
    });
    it('isolated fees: marketing taxes should be correctly initialized', async () => {
        const marketingTax = await token.taxMarketing();
        assertBigNumberEqual(marketingTax, percentToRaw(fees.marketingFee));
    });
})