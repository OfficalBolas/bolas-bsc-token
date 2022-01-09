const {percentToRaw, tokenToRaw} = require("../test/utils/test_utils");
const {fees, uniswap} = require("../test/config/token_config");

// Contract literals
const BOLAS = 'BOLAS'
const IterableMapping = 'IterableMapping'
const BOLASDividendTracker = 'BOLASDividendTracker'

// Method literals
const transferOwnership = 'transferOwnership';
const initialize = 'initialize';
const switchAutoBurn = 'switchAutoBurn';
const switchAutoDividend = 'switchAutoDividend';
const switchAutoSwapAndLiquify = 'switchAutoSwapAndLiquify';
const switchAutoDividendProcessing = 'switchAutoDividendProcessing';
const setAllTaxApps = 'setAllTaxApps';
const setTaxMarketing = 'setTaxMarketing';
// deployment
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, execute, get} = deployments;
    const {deployer, appWallet, marketingWallet, liquidityWallet} = await getNamedAccounts();
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
    await execute(BOLAS, {from: deployer}, initialize, dividendTracker.address, appWallet, marketingWallet, liquidityWallet);
    // fees
    await execute(BOLAS, {from: deployer}, switchAutoBurn, percentToRaw(fees.burnFee), true);
    await execute(BOLAS, {from: deployer}, switchAutoDividend, percentToRaw(fees.dividendFee), true);
    await execute(BOLAS, {from: deployer}, switchAutoSwapAndLiquify, percentToRaw(fees.liquidityFee), uniswap.routerAddress, tokenToRaw(uniswap.minTokensBeforeSwap), true);
    await execute(BOLAS, {from: deployer}, switchAutoDividendProcessing, true);
    await execute(BOLAS, {from: deployer}, setTaxMarketing, percentToRaw(fees.marketingFee));
    await execute(BOLAS, {from: deployer}, setAllTaxApps, fees.appFees.map((fee) => percentToRaw(fee)));
};
module.exports.tags = [BOLAS];