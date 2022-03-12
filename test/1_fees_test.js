const testHelpers = require('./helpers/test_helpers');
const {fees} = require("../config/token_config");
const {
    assertBigNumberEqual,
    tokenToRaw,
    percentToRaw,
    getEthBalance,
    toWei,
    assertBigNumberGt
} = require("./helpers/test_utils");
const {getNamedAccounts} = require("hardhat");
const {getTransferAmount} = require("./helpers/test_helpers");
let namedAccounts;
let token;

contract('BOLAS FEES TEST', (accounts) => {
    before(async () => {
        namedAccounts = await getNamedAccounts();
        token = await testHelpers.reinitializeToken(accounts);
        await testHelpers.setupLiquidity(token, accounts);
    })

    // CREATION
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })

    // TRANSFER
    it('transfers: should transfer without fees 10000 to accounts[2] with accounts[1] having 10000', async () => {
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })

    it('transfers: should transfer without fees 10000 to accounts[1] with accounts[0] having 10000', async () => {
        token = await testHelpers.reinitializeToken(accounts);
        await testHelpers.setupLiquidity(token, accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[0]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })

    it('transfers: balances match after transfer with fees', async () => {
        token = await testHelpers.reinitializeToken(accounts);
        await testHelpers.setupLiquidity(token, accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })

    // total supply & burnt
    it('total supply: total supply should not be reduced because no burns', async () => {
        const totalSupply = await token.totalSupply();
        assertBigNumberEqual(totalSupply, '192000000000000000000000000000000');
    });
    it('total burnt: total burnt should be 0 because no fees yet', async () => {
        const totalBurnt = await token.totalBurnt();
        assertBigNumberEqual(totalBurnt, '0');
    });

    // Isolated fees
    it('isolated fees: app taxes should be correctly initialized', async () => {
        const percentToSet = fees.appFees[0];
        await token.setTaxApps(0, percentToRaw(percentToSet));
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

    // wallet balances
    it('isolated fees: marketing wallet has BNB', async () => {
        const liquidityWallet = await getEthBalance(namedAccounts.marketingWallet);
        assertBigNumberEqual(liquidityWallet, '10000000000000000000000');
    });
    it('isolated fees: apps wallet has BNB', async () => {
        const liquidityWallet = await getEthBalance(namedAccounts.appWallet);
        assertBigNumberEqual(liquidityWallet, '10000000000000000000000');
    });

    // Do some swaps
    it('Buying tokens for 0.3 ETH should work', async () => {
        token = await testHelpers.reinitializeToken(accounts);
        await testHelpers.setupLiquidity(token, accounts);
        await testHelpers.buyTokens(token, 0.3, accounts[1]);
        const balance = await token.balanceOf(accounts[1])
        assert.ok(balance);
    });

    it('Selling 80,000,000 tokens for ETH should work', async () => {
        await testHelpers.sellTokens(token, 80_000_000, accounts[1]);
        const balance = await token.balanceOf(accounts[1])
        assert.ok(balance);
    });

    // wallet balances
    it('isolated fees: marketing wallet has BNB', async () => {
        const marketingWallet = await getEthBalance(namedAccounts.marketingWallet);
        assertBigNumberGt(marketingWallet, toWei(0));
    });
    it('isolated fees: apps wallet has BNB', async () => {
        const liquidityWallet = await getEthBalance(namedAccounts.appWallet);
        assertBigNumberGt(liquidityWallet, toWei(0));
    });
    it('isolated fees: staking wallet has tokens', async () => {
        const stakingWallet = await token.balanceOf(namedAccounts.stakingWallet)
        assertBigNumberGt(stakingWallet, toWei(0));
    });

    // fee on transfer
    it('Buying tokens for 0.3 ETH should work with fee on transfer', async () => {
        token = await testHelpers.reinitializeToken(accounts);
        await token.setFeeOnTransferEnabled(true);
        await testHelpers.setupLiquidity(token, accounts);
        await testHelpers.buyTokens(token, 0.3, accounts[1]);
        const balance = await token.balanceOf(accounts[1])
        assert.ok(balance);
    });

    it('Selling 80,000,000 tokens for ETH should work with fee on transfer', async () => {
        await testHelpers.sellTokens(token, 80_000_000, accounts[1]);
        const balance = await token.balanceOf(accounts[1])
        assert.ok(balance);
    });

    it('Transfer 10000 should work with fee on transfer', async () => {
        await token.transfer(accounts[3], tokenToRaw(10000), {from: accounts[1]})
        const balance = await token.balanceOf(accounts[3])
        assertBigNumberEqual(balance, tokenToRaw(getTransferAmount(10000, fees)))
    });
})