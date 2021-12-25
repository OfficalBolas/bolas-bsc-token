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
    return web3.utils.toWei(ethAmount);
}

function fromWei(weiAmount) {
    return web3.utils.fromWei(weiAmount);
}

function getEthBalance(accountAddress) {
    return web3.eth.getBalance(accountAddress);
}

module.exports = {
    assertFailure,
    toWei,
    fromWei,
    getEthBalance,
    getETHToTokenPath,
    getTokenToETHPath,
}