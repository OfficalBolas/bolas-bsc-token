const Big = require('big.js');
const {decimals} = require("../config/token_config");

async function assertFailure(executor) {
    let threw = false;
    try {
        await executor();
    } catch (e) {
        threw = true;
    }
    assert.equal(threw, true);
}

async function getETHToTokenPath(token, router) {
    return [
        await router.WETH(),
        token.address,
    ];
}

async function getTokenToETHPath(token, router) {
    return [
        token.address,
        await router.WETH(),
    ];
}

function toWei(ethAmount) {
    return web3.utils.toWei(ethAmount.toString());
}

function fromWei(weiAmount) {
    return web3.utils.fromWei(weiAmount.toString());
}

function getEthBalance(accountAddress) {
    return web3.eth.getBalance(accountAddress);
}

function getMinimumAmountWithSlippage(amount, slippagePercent) {
    return amount - (amount * slippagePercent) / 100.0;
}

function getMaximumAmountWithSlippage(amount, slippagePercent) {
    return amount + (amount * slippagePercent) / 100.0;
}

function rawToToken(rawAmount) {
    return new Big(rawAmount.toString()).div(new Big(10).pow(decimals)).toPrecision(decimals);
}

function rawToTokenNumber(rawAmount) {
    return parseFloat(rawToToken(rawAmount));
}

function tokenToRaw(tokenAmount) {
    return new Big(tokenAmount).mul(new Big(10).pow(decimals)).toFixed(0);
}

function bigNumberEqual(a, b) {
    return new Big(a.toString()).eq(new Big(b.toString()));
}

function assertBigNumberEqual(a, b) {
    assert(bigNumberEqual(a, b), `${a.toString()} != ${b.toString()}`);
}

module.exports = {
    assertFailure,
    toWei,
    fromWei,
    getEthBalance,
    getETHToTokenPath,
    getTokenToETHPath,
    getMinimumAmountWithSlippage,
    getMaximumAmountWithSlippage,
    rawToToken,
    tokenToRaw,
    rawToTokenNumber,
    bigNumberEqual,
    assertBigNumberEqual,
}