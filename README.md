# Official BOLAS Repository
## Introduction
The Bolas ecosystem consists of a deflationary, fee-on-transfer Binance Smart Chain token, an amazing range of NFTs, a NFT marketplace and a series of play-to-earn mobile games. All these components cohesively work together for a secure and amazing experience for our users.

The Bolas ecosystem is designed to make every community member a stakeholder. Which means every investor, big or small, actively contributes and earns back from their investments while boosting Bolas to the top of the play-to-earn gaming industry. By allowing the community to be heard in our community, every holder of Bolas is invested in deciding the future of Bolas.

This repository contains the source code & hardhat tests for our BOLAS Binance Smart Chain token.
## Links
- [Official website](https://bolasofficial.com)
- [Twitter](https://twitter.com/BolasOffical)
- [Telegram](https://t.me/Bolas_Official)
- [Buy BOLAS on pancakeswap](https://pancakeswap.finance/swap?outputCurrency=0x621cB0B384b366ED55Dfc2A213288955C02E5aB1)
- [Whitepaper](https://bolasofficial.com/assets/pdf/Bolas%20Whitepaper%20Version%202.1.pdf)
## Technologies
- Solidity
- Openzeppelin
- Hardhat (main framework)
- Web3
- NodeJS
## Prerequisites
- Git
- NodeJS with npm & npx
## Installation
1. Clone the repository to your machine.
2. Run `npm install`
3. Make a copy of `.env.example` with the name `.env` with
   - MNEMONIC
   - BSC\_API\_KEY
   - DEPLOYER\_WALLET
   - LIQUIDITY\_WALLET
   - APP\_WALLET
   - MARKETING\_WALLET
## Testing
- For hardhat network testing run `npx hardhat test --network hardhat`
- For BscTestnet testing run `npx hardhat test --network testnet`
## Deploying
- For hardhat network deploying run `npx hardhat deploy --network hardhat`
- For BscTestnet deploying run `npx hardhat deploy --network testnet`
- For Bsc deploying run `npx hardhat deploy --network production`
## License
Project is under [MIT License](https://github.com/browserify/node-util/blob/master/LICENSE)