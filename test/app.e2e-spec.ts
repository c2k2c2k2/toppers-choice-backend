import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';

describe('Backend foundation (e2e)', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.API_PREFIX = 'api/v1';
    process.env.SWAGGER_PATH = 'docs';
    process.env.SWAGGER_ENABLED = 'true';
    process.env.DEFAULT_SITE_CODE = 'toppers-choice';
    process.env.APP_BASE_URL = 'http://localhost:3000';
    delete process.env.DATABASE_URL;

    const configValues: Record<string, unknown> = {
      NODE_ENV: 'test',
      PORT: 3000,
      API_PREFIX: 'api/v1',
      SWAGGER_PATH: 'docs',
      SWAGGER_ENABLED: true,
      DATABASE_URL: undefined,
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      DEFAULT_SITE_CODE: 'toppers-choice',
      APP_BASE_URL: 'http://localhost:3000',
      CORS_ORIGINS: [],
      SITE_SETTINGS_CACHE_TTL_MS: 30_000,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: <T>(key: string): T | undefined =>
          configValues[key] as T | undefined,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a live health response with a propagated request id', async () => {
    const response = await request(httpServer)
      .get('/api/v1/health')
      .expect(200);
    const body = response.body as { status: string };

    expect(body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('returns a consistent readiness error shape when the database is not configured', async () => {
    const response = await request(httpServer)
      .get('/api/v1/health/readiness')
      .expect(503);
    const body = response.body as {
      code: string;
      details: {
        dependencies: {
          database: {
            status: string;
          };
        };
      };
      requestId: string;
    };

    expect(body.code).toBe('SERVICE_NOT_READY');
    expect(body.details.dependencies.database.status).toBe('not_configured');
    expect(body.requestId).toBeDefined();
  });

  it('serves the generated Swagger document', async () => {
    const response = await request(httpServer).get('/docs-json').expect(200);
    const body = response.body as {
      info: {
        title: string;
      };
      paths: Record<string, unknown>;
    };
    const pathKeys = Object.keys(body.paths);

    expect(body.info.title).toBe("Toppers' Choice Backend API");
    expect(pathKeys.some((path) => path.endsWith('/health'))).toBe(true);
  });

  it('returns a site bootstrap error until the database-backed site settings are configured', async () => {
    const response = await request(httpServer)
      .get('/api/v1/public/bootstrap')
      .expect(503);
    const body = response.body as { code: string };

    expect(body.code).toBe('DATABASE_NOT_CONFIGURED');
  });
});
