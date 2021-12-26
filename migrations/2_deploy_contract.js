const BOLAS = artifacts.require("BOLAS");

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(BOLAS);
    const bolas = await BOLAS.deployed();
    await bolas.initialize(accounts[9]);
}