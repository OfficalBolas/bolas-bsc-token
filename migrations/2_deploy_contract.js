const BOLAS = artifacts.require("BOLAS");
const IterableMapping = artifacts.require("IterableMapping");

module.exports = async function (deployer) {
    await deployer.deploy(IterableMapping)
    await deployer.link(IterableMapping, BOLAS)
    await deployer.deploy(BOLAS)
}