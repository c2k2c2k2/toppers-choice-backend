import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validateEnvironment } from './infra/config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RequestContextModule } from './infra/request-context/request-context.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      envFilePath: ['.env.local', '.env'],
      validate: validateEnvironment,
    }),
    RequestContextModule,
    PrismaModule,
    HealthModule,
    SiteSettingsModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
