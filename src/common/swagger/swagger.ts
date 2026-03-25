import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  ApiErrorDetailDto,
  ApiErrorResponseDto,
} from '../dto/api-error-response.dto';
import {
  HealthDependencyDto,
  HealthLivenessResponseDto,
  HealthReadinessResponseDto,
} from '../../modules/health/dto/health-response.dto';
import { PublicBootstrapResponseDto } from '../../modules/site-settings/dto/public-bootstrap-response.dto';
import { ResolveSiteBootstrapQueryDto } from '../../modules/site-settings/dto/resolve-site-bootstrap-query.dto';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
) {
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED') ?? true;
  if (!swaggerEnabled) {
    return;
  }

  const apiPrefix = configService.get<string>('API_PREFIX') ?? 'api/v1';
  const swaggerPath = configService.get<string>('SWAGGER_PATH') ?? 'docs';
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Topper's Choice Backend API")
      .setDescription(
        "Production-ready backend foundation for Topper's Choice.",
      )
      .setVersion('1.0.0')
      .addServer(`/${apiPrefix}`, 'Versioned REST API')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Short-lived note view token returned by POST /notes/:noteId/view-session.',
        },
        'note-view-token',
      )
      .build(),
    {
      extraModels: [
        ApiErrorDetailDto,
        ApiErrorResponseDto,
        HealthDependencyDto,
        HealthLivenessResponseDto,
        HealthReadinessResponseDto,
        PublicBootstrapResponseDto,
        ResolveSiteBootstrapQueryDto,
      ],
    },
  );

  SwaggerModule.setup(swaggerPath, app, document, {
    jsonDocumentUrl: `${swaggerPath}-json`,
    swaggerOptions: {
      displayRequestDuration: true,
      persistAuthorization: true,
    },
  });
}
