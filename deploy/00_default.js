const {percentToRaw, tokenToRaw} = require("../test/utils/test_utils");
const {fees, uniswap} = require("../test/config/token_config");
const {gasConfigs} = require("../test/config/network_config");

// Contract literals
const BOLAS = 'BOLAS'
const IterableMapping = 'IterableMapping'
const BOLASDividendTracker = 'BOLASDividendTracker'

// Method literals
const transferOwnership = 'transferOwnership';
const updateDividendTracker = 'updateDividendTracker';
const switchAutoBurn = 'switchAutoBurn';
const switchAutoDividend = 'switchAutoDividend';
const switchAutoSwapAndLiquify = 'switchAutoSwapAndLiquify';
const switchAutoDividendProcessing = 'switchAutoDividendProcessing';
const setAllTaxApps = 'setAllTaxApps';
const setTaxMarketing = 'setTaxMarketing';
// deployment
module.exports = async ({getNamedAccounts, network, deployments}) => {
    const gasConfig = gasConfigs[network.name]
    const {deploy, execute, get} = deployments;
    const {deployer, appWallet, marketingWallet, liquidityWallet} = await getNamedAccounts();

    // deploy BOLAS contract
    const bolas = await deploy(BOLAS, {
        from: deployer, ...gasConfig,
        args: [appWallet, marketingWallet, liquidityWallet]
    });

    // deploy IterableMapping
    const iterableMapping = await deploy(IterableMapping, {from: deployer, ...gasConfig});

    // deploy BOLASDividendTracker
    const dividendTracker = await deploy(BOLASDividendTracker, {
        from: deployer,
        libraries: {IterableMapping: iterableMapping.address},
        ...gasConfig
    });

    // initialize BOLASDividendTracker
    await execute(BOLASDividendTracker, {from: deployer, ...gasConfig}, transferOwnership, bolas.address);
    await execute(BOLAS, {from: deployer, ...gasConfig}, updateDividendTracker, dividendTracker.address);

    // fees
    await execute(BOLAS, {from: deployer, ...gasConfig}, switchAutoBurn, percentToRaw(fees.burnFee), true);
    await execute(BOLAS, {from: deployer, ...gasConfig}, switchAutoDividend, percentToRaw(fees.dividendFee), true);
    await execute(BOLAS, {from: deployer, ...gasConfig}, switchAutoSwapAndLiquify, percentToRaw(fees.liquidityFee), uniswap.routerAddress, tokenToRaw(uniswap.minTokensBeforeSwap), true);
    await execute(BOLAS, {from: deployer, ...gasConfig}, switchAutoDividendProcessing, true);
    await execute(BOLAS, {from: deployer, ...gasConfig}, setTaxMarketing, percentToRaw(fees.marketingFee));
    await execute(BOLAS, {from: deployer, ...gasConfig}, setAllTaxApps, fees.appFees.map((fee) => percentToRaw(fee)));
};
module.exports.tags = [BOLAS];