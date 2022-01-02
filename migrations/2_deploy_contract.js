const BOLAS = artifacts.require("BOLAS");
const BOLASDividendTracker = artifacts.require("BOLASDividendTracker");
const IterableMapping = artifacts.require("IterableMapping");

module.exports = async function (deployer, network, accounts) {
    // deploy & link IterableMapping
    await deployer.deploy(IterableMapping);
    await deployer.link(IterableMapping, BOLASDividendTracker);

    // deploy BOLASDividendTracker
    await deployer.deploy(BOLASDividendTracker);
    const dividendTracker = await BOLASDividendTracker.deployed();
    // deploy BOLAS contract
    await deployer.deploy(BOLAS);
    const bolas = await BOLAS.deployed();

    // initialize contract
    await dividendTracker.transferOwnership(bolas.address);
    await bolas.initialize(dividendTracker.address);
}