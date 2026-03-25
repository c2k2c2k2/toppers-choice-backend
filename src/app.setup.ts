import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { setupSwagger } from './common/swagger/swagger';
import { RequestContextMiddleware } from './infra/request-context/request-context.middleware';

export function configureApplication(app: INestApplication) {
  const configService = app.get(ConfigService);
  const requestContextMiddleware = app.get(RequestContextMiddleware);
  const apiPrefix = configService.get<string>('API_PREFIX') ?? 'api/v1';
  const corsOrigins = configService.get<string[]>('CORS_ORIGINS') ?? [];

  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  setupSwagger(app, configService);
}
