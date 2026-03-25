import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validateEnvironment } from './infra/config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RequestContextModule } from './infra/request-context/request-context.module';
import { StorageModule } from './infra/storage/storage.module';
import { AuditInterceptor } from './modules/authorization/interceptors/audit.interceptor';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { PolicyGuard } from './modules/authorization/policy.guard';
import { AuthModule } from './modules/auth/auth.module';
import { AccessTokenGuard } from './modules/auth/guards/access-token.guard';
import { ContentModule } from './modules/content/content.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { NotesModule } from './modules/notes/notes.module';
import { PracticeModule } from './modules/practice/practice.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { TestsModule } from './modules/tests/tests.module';
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
    StorageModule,
    HealthModule,
    SiteSettingsModule,
    UsersModule,
    AuthModule,
    AuthorizationModule,
    TaxonomyModule,
    FilesModule,
    ContentModule,
    NotesModule,
    QuestionsModule,
    PracticeModule,
    TestsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PolicyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
