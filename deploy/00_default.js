const {networkConfigs} = require("../test/config/network_config");
const {uniswap} = require("../test/config/token_config");

// Contract literals
const BOLAS = 'BOLAS'
const BOLASDividendTracker = 'BOLASDividendTracker'
const IterableMapping = 'IterableMapping'

// method literals
const transferOwnership = 'transferOwnership'
const updateDividendTracker = 'updateDividendTracker'

// deployment
module.exports = async ({getNamedAccounts, network, deployments}) => {
    const gasConfig = networkConfigs[network.name].gasConfig;
    const {deploy, execute, get} = deployments;
    const {deployer, appWallet, marketingWallet, liquidityWallet} = await getNamedAccounts();

    // deploy IterableMapping
    const iterableMapping = await deploy(IterableMapping, {from: deployer, ...gasConfig});

    // deploy BOLASDividendTracker
    const dividendTracker = await deploy(BOLASDividendTracker, {
        from: deployer,
        libraries: {IterableMapping: iterableMapping.address},
        ...gasConfig
    });

    // deploy BOLAS contract
    const bolas = await deploy(BOLAS, {
        from: deployer, ...gasConfig,
        args: [appWallet, marketingWallet, liquidityWallet, networkConfigs[network.name].uniswapAddress]
    });
    await execute(BOLASDividendTracker, {from: deployer, ...gasConfig}, transferOwnership, bolas.address);
    await execute(BOLAS, {from: deployer, ...gasConfig}, updateDividendTracker, dividendTracker.address);

    if (network.name !== 'hardhat') {
        console.log(`IterableMapping was deployed at:\n${iterableMapping.address}`)
        console.log(`DividendTracker was deployed at:\n${dividendTracker.address}`)
        console.log(`BOLAS token was deployed at:\n${bolas.address}`)
    }
};
module.exports.tags = [BOLAS];