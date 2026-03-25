import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const queryRawMock = jest.fn();
  const getConfigMock = jest.fn();
  const prisma = {
    $queryRaw: queryRawMock,
  } as unknown as PrismaService;
  const configService = {
    get: getConfigMock,
  } as unknown as ConfigService;

  let service: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HealthService(prisma, configService);
  });

  it('returns not configured readiness when DATABASE_URL is missing', async () => {
    getConfigMock.mockImplementation((key: string) => {
      if (key === 'DATABASE_URL') {
        return undefined;
      }
      if (key === 'NODE_ENV') {
        return 'test';
      }
      return undefined;
    });

    const readiness = await service.getReadiness();

    expect(readiness.ready).toBe(false);
    expect(readiness.dependencies.database.status).toBe('not_configured');
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it('returns ready when the database probe succeeds', async () => {
    getConfigMock.mockImplementation((key: string) => {
      if (key === 'DATABASE_URL') {
        return 'postgresql://postgres:postgres@localhost:5432/toppers_choice';
      }
      if (key === 'NODE_ENV') {
        return 'test';
      }
      return undefined;
    });
    queryRawMock.mockResolvedValue([{ '?column?': 1 }]);

    const readiness = await service.getReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.dependencies.database.status).toBe('up');
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });
});
