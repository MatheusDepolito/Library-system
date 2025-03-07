import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { ListenerModule } from './listener/listener.module';

@Module({
  imports: [PrismaModule, ListenerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
