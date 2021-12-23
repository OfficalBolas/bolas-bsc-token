function getTransferAmount(amount, config) {
    const taxAmount = amount * config.taxFee / 100;
    const liquidityAmount = amount * config.liquidityFee / 100;
    const intermediateAmount = amount - (taxAmount + liquidityAmount);
    const burnAmount = intermediateAmount * config.burnFee / 100;
    const charityAmount = intermediateAmount * config.charityFee / 100;
    return intermediateAmount - (burnAmount + charityAmount);
}

module.exports = {
    getTransferAmount
}