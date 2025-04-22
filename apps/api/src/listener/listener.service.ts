import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  LibraryChain,
  LibraryChain__factory,
} from '../../../../standalone/library-chain-contract/typechain-types';
import { contractAddress } from 'src/common/util';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { BookStatus } from '@prisma/client';

const statusMapping = [
  BookStatus.RESERVED,
  BookStatus.BORROWED,
  BookStatus.AVAILABLE,
  BookStatus.LOST,
];

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
        async (id, name, location, contact, event) => {
          // @ts-expect-error: event.log is any type
          const blockNumber = event.log.blockNumber;
          const timestamp = await this.getBlockTimeStamp(blockNumber);

          const newPublisher = await this.createPublisher({
            id: id.toString(),
            name,
            location,
            contact,
            timestamp,
          });
          console.log('Event: PublisherRegistered:', newPublisher);
        },
      );
      console.log('Event: PublisherRegistered Listening...');
    } catch (error) {
      console.error('Event: BookCreated: Listener setup failed.', error);
    }

    try {
      this.contract.on(
        this.contract.filters.BookCreated,
        async (id, name, publisher, event) => {
          // @ts-expect-error: event.log is any type
          const blockNumber = event.log.blockNumber;
          const timestamp = await this.getBlockTimeStamp(blockNumber);

          await this.createBook({
            publisher,
            bookId: id.toString(),
            name,
            timestamp,
          });
        },
      );
    } catch (error) {
      console.error('Event: BookCreated: Listener setup failed.', error);
    }

    try {
      this.contract.on(
        this.contract.filters.BookItemsAdded,
        async (bookItemIds, bookId, event) => {
          // @ts-expect-error: event.log is any type
          const blockNumber = event.log.blockNumber;
          const timestamp = await this.getBlockTimeStamp(blockNumber);

          const items = await this.createBookItems({
            bookItemIds,
            bookId: bookId.toString(),
            timestamp,
          });

          console.log('Event: BookItemsAdded:', bookItemIds, bookId, timestamp);
        },
      );
    } catch (error) {}

    try {
      this.contract.on(
        this.contract.filters.BookItemsStatusChanged,
        async (bookItemIds, statusIndex, event) => {
          // @ts-expect-error: event.log is any type
          const blockNumber = event.log.blockNumber;
          const timestamp = await this.getBlockTimeStamp(blockNumber);

          await this.updateBookItemStatus({
            bookItemIds,
            statusIndex: +statusIndex.toString(),
            timestamp,
          });

          console.log(
            'Event: BookItemsStatusChanged:',
            bookItemIds,
            statusIndex,
            timestamp,
          );
        },
      );
    } catch (error) {
      console.error(
        'Event: BookItemsStatusChanged: Listener setup failed.',
        error,
      );
    }

    try {
      this.contract.on(
        this.contract.filters.ChapterCreated,
        async (bookId, name, pagesCount, event) => {
          // @ts-expect-error: event.log is any type
          const blockNumber = event.log.blockNumber;
          const timestamp = await this.getBlockTimeStamp(blockNumber);

          await this.createChapter({
            name,
            pagesCount: Number(pagesCount),
            bookId: bookId.toString(),
            timestamp,
          });
        },
      );

      console.log('Event: ChapterCreated: Listening...');
    } catch (error) {
      console.error('Event: ChapterCreated: Listener setup failed.', error);
    }
  }

  cleanup() {
    this.provider.removeAllListeners();
  }

  async getBlockTimeStamp(blockNumber: number) {
    const block = await this.provider.getBlock(blockNumber);

    return new Date(block.timestamp * 1000);
  }

  private updateBookItemStatus({
    bookItemIds,
    statusIndex,
    timestamp,
  }: {
    bookItemIds: string[];
    statusIndex: number;
    timestamp: Date;
  }) {
    const status = statusMapping[+statusIndex.toString()] as BookStatus;
    const transactions = bookItemIds.map((bookItemId) => {
      return this.prisma.transaction.create({
        data: {
          status,
          bookItemId,
          timestamp,
        },
      });
    });

    const bookItemUpdates = this.prisma.bookItem.updateMany({
      data: { status, timestamp },
      where: { id: { in: bookItemIds } },
    });

    return this.prisma.$transaction([bookItemUpdates, ...transactions]);
  }

  private createBookItems({
    bookId,
    bookItemIds,
    timestamp,
  }: {
    bookId: string;
    bookItemIds: string[];
    timestamp: Date;
  }) {
    const transaction = bookItemIds.map((bookItemId) => {
      return this.prisma.transaction.create({
        data: {
          status: BookStatus.RESERVED,
          bookItemId,
          timestamp,
        },
      });
    });
    const bookItemUpdates = this.prisma.bookItem.updateMany({
      data: bookItemIds.map((id) => ({
        id,
        bookId: bookId.toString(),
        status: BookStatus.RESERVED,
        timestamp,
      })),
    });

    return this.prisma.$transaction([bookItemUpdates, ...transaction]);
  }

  private async createPublisher({
    id,
    name,
    location,
    contact,
    timestamp,
  }: {
    id: string;
    name: string;
    location: string;
    contact: string;
    timestamp: Date;
  }) {
    return this.prisma.publisher.create({
      data: { id, name, location, contact, timestamp },
    });
  }

  private async createBook({
    publisher,
    name,
    bookId,
    timestamp,
  }: {
    publisher: string;
    name: string;
    bookId: string;
    timestamp: Date;
  }) {
    return this.prisma.book.create({
      data: {
        id: bookId,
        name,
        publisher: { connect: { id: publisher } },
        timestamp,
      },
    });
  }
  private async createChapter({
    bookId,
    name,
    pagesCount,
    timestamp,
  }: {
    bookId: string;
    name: string;
    pagesCount: number;
    timestamp: Date;
  }) {
    const maxRetries = 5;
    let retryCount = 0;

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (retryCount < maxRetries) {
      const book = await this.prisma.book.findUnique({
        where: { id: bookId },
      });

      if (book) {
        const chapter = await this.prisma.chapterItem.create({
          data: {
            name,
            pagesCount,
            bookId,
            timestamp,
          },
        });

        console.log('Chapter created:', chapter);
        return;
      } else {
        console.error(`Book with ID ${bookId} not found. Retrying...`);
        await delay(1000);
        retryCount++;
      }
    }
  }
}
