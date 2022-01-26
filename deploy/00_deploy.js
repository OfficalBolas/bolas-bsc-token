const {networkConfigs} = require("../config/network_config");
const {uniswap} = require("../config/token_config");

// Contract literals
const BOLAS = 'BOLAS'
const BOLASDividendTracker = 'BOLASDividendTracker'
const IterableMapping = 'IterableMapping'

// method literals
const transferOwnership = 'transferOwnership'
const updateDividendTracker = 'updateDividendTracker'

// deployment
module.exports = async ({getNamedAccounts, network, deployments, run}) => {
    const isHardhat = network.name === 'hardhat';
    const gasConfig = networkConfigs[network.name].gasConfig;
    const {deploy, execute, get} = deployments;
    const {
        deployer,
        appWallet,
        marketingWallet,
        liquidityWallet
    } = await getNamedAccountsOfNetwork(getNamedAccounts, network);

    // deploy IterableMapping
    const iterableMapping = await deploy(IterableMapping, {
        from: deployer, ...gasConfig,
        skipIfAlreadyDeployed: true,
    });

    // deploy BOLASDividendTracker
    const dividendTracker = await deploy(BOLASDividendTracker, {
        from: deployer,
        skipIfAlreadyDeployed: false,
        libraries: {IterableMapping: iterableMapping.address},
        ...gasConfig
    });

    // deploy BOLAS contract
    const constructorArguments = [appWallet, marketingWallet, liquidityWallet, networkConfigs[network.name].uniswapAddress];
    const bolas = await deploy(BOLAS, {
        from: deployer, ...gasConfig,
        skipIfAlreadyDeployed: false,
        args: constructorArguments,
    });
    await execute(BOLASDividendTracker, {from: deployer, ...gasConfig}, transferOwnership, bolas.address);
    await execute(BOLAS, {from: deployer, ...gasConfig}, updateDividendTracker, dividendTracker.address);

    if (!isHardhat) {
        console.log(`Deployment completed at: ${new Date().toLocaleString()}`);
        console.log(`IterableMapping was deployed at:\n${iterableMapping.address}`);
        console.log(`DividendTracker was deployed at:\n${dividendTracker.address}`);
        console.log(`BOLAS token was deployed at:\n${bolas.address}`);
    }
};

async function getNamedAccountsOfNetwork(getNamedAccounts, network) {
    if (network.name === 'hardhat') return getNamedAccounts();
    if (network.name === 'testnet') return getNamedAccounts();
    if (network.name === 'production') return {
        deployer: process.env.DEPLOYER_WALLET,
        liquidityWallet: process.env.LIQUIDITY_WALLET,
        appWallet: process.env.APP_WALLET,
        marketingWallet: process.env.MARKETING_WALLET,
    }
}

module.exports.tags = [BOLAS];