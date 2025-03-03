import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require('dotenv').config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  defaultNetwork: 'amoy',
  networks: {
    amoy: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY || '']
    }
  }
};

export default config;
