const {tokenToRaw, assertBigNumberEqual, percentToRaw} = require("./utils/test_utils");
const testHelpers = require("./utils/test_helpers");
const {deployments} = require("hardhat");
const {resetNetwork} = require("./utils/test_helpers");
const {fees} = require("./config/token_config");
const testUtils = require("./utils/test_utils");
const MarketLedger = artifacts.require('MarketLedger')
const IDexRouter = artifacts.require('IDexRouter')

let token;

async function reinitializeMarketLedgerToken(accounts) {
    await resetNetwork();
    await deployments.fixture(['MarketLedger']);
    const tokenDep = await deployments.get('MarketLedger');
    token = await MarketLedger.at(tokenDep.address);
    // add liquidity
    const liquidityETHAmount = 100;
    const liquidityTokenAmount = 100_000;
    const router = await IDexRouter.at('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
    const totalSupply = await token.totalSupply();
    await token.approve(router.address, totalSupply, {from: accounts[0]});
    await router.addLiquidityETH(
        token.address, tokenToRaw(liquidityTokenAmount), 0, 0, accounts[0], new Date().getTime() + 3600000,
        {from: accounts[0], value: testUtils.toWei(liquidityETHAmount)});

    await token.transfer(accounts[1], tokenToRaw(10000), {from: accounts[0]})
}

contract('MarketLedger LAB TEST', (accounts) => {
    before(async () => {
        await reinitializeMarketLedgerToken(accounts);
    });

    // META DATA

    // CREATION
    it('should create an initial balance of 10000 for the account[1]', async () => {
        const balance = await token.balanceOf(accounts[1])
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })

    // TRANSFER
    it('transfers: should transfer with fees 10000 to accounts[2] with accounts[1] having 10000', async () => {
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, '9000000000000000000000')
    })

    it('transfers: balances match after transfer with fees', async () => {
        await reinitializeMarketLedgerToken(accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[1]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, '9000000000000000000000')
    })

    it('transfers: should transfer with no fees 10000 to accounts[1] with accounts[0] having 10000', async () => {
        await reinitializeMarketLedgerToken(accounts);
        await token.transfer(accounts[2], tokenToRaw(10000), {from: accounts[0]});
        const balance = await token.balanceOf(accounts[2]);
        assertBigNumberEqual(balance, tokenToRaw(10000))
    })
})