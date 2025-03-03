import { ethers } from 'ethers';
import { contractAddress } from './util';
import { SimpleCounter__factory } from '../../standalone/simple-counter/typechain-types';
require('dotenv').config();
const main = () => {
  const infuraWssUrl = `https://eth-sepolia.g.alchemy.com/v2/${process.env.INFURA_KEY}`;

  const provider = new ethers.InfuraWebSocketProvider(infuraWssUrl);

  const contract = SimpleCounter__factory.connect(contractAddress, provider);

  try {
    contract.on(contract.filters['NumberIncremented'], (updatedNumber) => {
      console.log(updatedNumber);
    });
  } catch (error) {
    console.error(error);
  }

  try {
    contract.on(contract.filters['NumberDecremented'], (updatedNumber) => {
      console.log(updatedNumber);
    });
  } catch (error) {
    console.error(error);
  }
};

main();
