const BOLAS = artifacts.require("BOLAS");

module.exports = function (deployer) {
  deployer.deploy(BOLAS);
};
