const BOLAS = artifacts.require("BOLAS");

module.exports = async function (deployer) {
    await deployer.deploy(BOLAS)
}