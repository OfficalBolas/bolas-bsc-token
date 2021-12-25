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
        await router.WETH(),
        token.address,
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

module.exports = {
    assertFailure,
    toWei,
    fromWei,
    getEthBalance,
    getETHToTokenPath,
    getTokenToETHPath,
    getMinimumAmountWithSlippage,
    getMaximumAmountWithSlippage,
}