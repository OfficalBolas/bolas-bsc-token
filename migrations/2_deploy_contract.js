const BOLAS = artifacts.require("BOLAS");

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(BOLAS, accounts[9])
}