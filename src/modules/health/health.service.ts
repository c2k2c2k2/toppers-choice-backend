import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service: 'toppers-choice-backend',
      environment: this.configService.get<string>('NODE_ENV') ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const timestamp = new Date().toISOString();
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      return {
        ready: false,
        status: 'not_ready',
        timestamp,
        dependencies: {
          database: {
            status: 'not_configured',
          },
        },
      };
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ready: true,
        status: 'ready',
        timestamp,
        dependencies: {
          database: {
            status: 'up',
          },
        },
      };
    } catch (error) {
      return {
        ready: false,
        status: 'not_ready',
        timestamp,
        dependencies: {
          database: {
            status: 'down',
            error: error instanceof Error ? error.message : String(error),
          },
        },
      };
    }
  }
}
