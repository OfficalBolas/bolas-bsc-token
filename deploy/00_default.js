const BOLAS = 'BOLAS'
const IterableMapping = 'IterableMapping'
const BOLASDividendTracker = 'BOLASDividendTracker'
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, execute, get} = deployments;
    const {deployer} = await getNamedAccounts();
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
    await execute(BOLASDividendTracker, {from: deployer}, 'transferOwnership', bolas.address);
    await execute(BOLAS, {from: deployer}, 'initialize', dividendTracker.address);
};
module.exports.tags = [BOLAS];