const {percentToRaw, tokenToRaw} = require("../test/utils/test_utils");
const {fees, uniswap} = require("../test/config/token_config");

// Contract literals
const MarketLedger = 'MarketLedger'

// Method literals
const SetupEnableTrading = 'SetupEnableTrading'

// deployment
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, execute, get} = deployments;
    const {deployer, appWallet, marketingWallet, liquidityWallet} = await getNamedAccounts();
    // deploy MarketLedger contract
    await deploy(MarketLedger, {from: deployer});
    await execute(MarketLedger, {from: deployer}, SetupEnableTrading);
};
module.exports.tags = [MarketLedger];