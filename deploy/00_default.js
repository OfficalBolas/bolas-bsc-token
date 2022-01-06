const {percentToRaw, tokenToRaw} = require("../test/utils/test_utils");
const {fees, uniswap} = require("../test/config/token_config");

// Contract literals
const BOLAS = 'BOLAS'
const IterableMapping = 'IterableMapping'
const BOLASDividendTracker = 'BOLASDividendTracker'

// Method literals
const transferOwnership = 'transferOwnership';
const initialize = 'initialize';
const enableAutoBurn = 'enableAutoBurn';
const enableAutoDividend = 'enableAutoDividend';
const enableAutoSwapAndLiquify = 'enableAutoSwapAndLiquify';
const setAllTaxApps = 'setAllTaxApps';
const setTaxMarketing = 'setTaxMarketing';
// deployment
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, execute, get} = deployments;
    const {deployer, appWallet, marketingWallet} = await getNamedAccounts();
    // deploy IterableMapping
    const iterableMapping = await deploy(IterableMapping, {from: deployer});
    // deploy BOLASDividendTracker
    const dividendTracker = await deploy(BOLASDividendTracker, {
        from: deployer,
        libraries: {IterableMapping: iterableMapping.address}
    });
    // deploy BOLAS contract
    const bolas = await deploy(BOLAS, {from: deployer});

    // initialize contract
    await execute(BOLASDividendTracker, {from: deployer}, transferOwnership, bolas.address);
    await execute(BOLAS, {from: deployer}, initialize, dividendTracker.address, appWallet, marketingWallet);
    await execute(BOLAS, {from: deployer}, enableAutoBurn, percentToRaw(fees.burnFee));
    await execute(BOLAS, {from: deployer}, enableAutoDividend, percentToRaw(fees.dividendFee));
    await execute(BOLAS, {from: deployer}, enableAutoSwapAndLiquify,
        percentToRaw(fees.liquidityFee), uniswap.routerAddress, tokenToRaw(uniswap.minTokensBeforeSwap));
    await execute(BOLAS, {from: deployer}, setAllTaxApps, fees.appFees.map((fee) => percentToRaw(fee)));
    await execute(BOLAS, {from: deployer}, setTaxMarketing, percentToRaw(fees.marketingFee));
};
module.exports.tags = [BOLAS];