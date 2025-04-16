import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  LibraryChain,
  LibraryChain__factory,
} from '../../../../standalone/library-chain-contract/typechain-types';
import { contractAddress } from 'src/common/util';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class ListenerService implements OnModuleInit, OnModuleDestroy {
  private provider: ethers.WebSocketProvider;
  private contract: LibraryChain;

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    this.cleanup();
  }

  onModuleInit() {
    this.initializeWebSocketProvider();
  }

  initializeWebSocketProvider() {
    const infuraWssUrl = `wss://eth-sepolia.g.alchemy.com/v2/${process.env.INFURA_KEY}`;
    this.provider = new ethers.WebSocketProvider(infuraWssUrl);

    this.contract = LibraryChain__factory.connect(
      contractAddress,
      this.provider,
    );
  }

  subscribeToEvents() {
    try {
      this.contract.on(
        this.contract.filters.PublisherRegistered,
        async (publisher, name, location, contact, event) => {
          // @ts-expect-error: event.log is any type
          const blockNumber = event.log.blockNumber;
          const timestamp = await this.getBlockTimeStamp(blockNumber);

          await this.prisma.publisher.create({
            data: { contact, id: publisher, location, name, timestamp },
          });
        },
      );
      console.log('Event: PublisherRegistered Listening...');
    } catch (error) {
      console.error('Event: BookCreated: Listener setup failed.', error);
    }
  }

  cleanup() {
    this.provider.removeAllListeners();
  }

  async getBlockTimeStamp(blockNumber: number) {
    const block = await this.provider.getBlock(blockNumber);

    return new Date(block.timestamp * 1000);
  }
}
