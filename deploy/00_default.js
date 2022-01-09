const {gasConfigs} = require("../test/config/network_config");
const {uniswap} = require("../test/config/token_config");

// Contract literals
const BOLAS = 'BOLAS'
const IterableMapping = 'IterableMapping'

// deployment
module.exports = async ({getNamedAccounts, network, deployments}) => {
    const gasConfig = gasConfigs[network.name]
    const {deploy, execute, get} = deployments;
    const {deployer, appWallet, marketingWallet, liquidityWallet} = await getNamedAccounts();

    // deploy IterableMapping
    const iterableMapping = await deploy(IterableMapping, {from: deployer, ...gasConfig});

    // deploy BOLAS contract
    await deploy(BOLAS, {
        from: deployer, ...gasConfig,
        libraries: {IterableMapping: iterableMapping.address},
        args: [appWallet, marketingWallet, liquidityWallet, uniswap.routerAddress]
    });
};
module.exports.tags = [BOLAS];