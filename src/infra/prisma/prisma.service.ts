import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(private readonly configService: ConfigService) {
    super({
      log:
        (configService.get<string>('NODE_ENV') ?? 'development') ===
        'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
