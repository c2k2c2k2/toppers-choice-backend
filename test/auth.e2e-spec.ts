import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus, UserType } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PasswordHasherService } from '../src/modules/auth/password-hasher.service';

describe('Auth and identity lifecycle (e2e)', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  let prisma: PrismaService;
  let passwordHasherService: PasswordHasherService;
  let defaultSiteId: string;
  let emailCounter = 0;
  let createdEmails: string[] = [];

  beforeAll(async () => {
    loadEnvironmentFile();
    process.env.NODE_ENV = 'test';
    process.env.PORT = process.env.PORT ?? '3000';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';
    process.env.SWAGGER_PATH = process.env.SWAGGER_PATH ?? 'docs';
    process.env.SWAGGER_ENABLED = process.env.SWAGGER_ENABLED ?? 'true';
    process.env.DEFAULT_SITE_CODE =
      process.env.DEFAULT_SITE_CODE ?? 'toppers-choice';
    process.env.APP_BASE_URL =
      process.env.APP_BASE_URL ?? 'http://localhost:3000';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret';

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for auth e2e tests.');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    passwordHasherService = app.get(PasswordHasherService);
    const site = await prisma.site.findFirstOrThrow({
      where: {
        isDefault: true,
      },
      select: {
        id: true,
      },
    });

    defaultSiteId = site.id;
  });

  afterEach(async () => {
    if (createdEmails.length === 0) {
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        email: {
          in: createdEmails,
        },
      },
      select: {
        id: true,
      },
    });
    const userIds = users.map((user) => user.id);

    if (userIds.length > 0) {
      await prisma.passwordResetToken.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });
      await prisma.refreshSession.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }

    createdEmails = [];
  });

  afterAll(async () => {
    await app.close();
  });

  it('supports student self-signup, me, sessions, and profile updates', async () => {
    const email = createEmail('signup');
    const signupResponse = await request(httpServer)
      .post('/api/v1/auth/signup')
      .set('User-Agent', 'auth-e2e')
      .send({
        fullName: 'Self Signup Student',
        email,
        password: 'StudyHard@123',
      })
      .expect(201);

    expect(signupResponse.body.user.email).toBe(email);
    expect(signupResponse.body.user.userType).toBe(UserType.STUDENT);
    expect(signupResponse.body.tokens.accessToken).toBeTruthy();
    expect(signupResponse.body.tokens.refreshToken).toBeTruthy();

    const accessToken = signupResponse.body.tokens.accessToken as string;
    const sessionId = signupResponse.body.tokens.sessionId as string;

    const meResponse = await request(httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.user.email).toBe(email);
    expect(meResponse.body.sessionId).toBe(sessionId);

    const sessionsResponse = await request(httpServer)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(sessionsResponse.body.sessions).toHaveLength(1);
    expect(sessionsResponse.body.sessions[0]).toMatchObject({
      id: sessionId,
      isCurrent: true,
      status: 'ACTIVE',
    });

    const profileResponse = await request(httpServer)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Updated Signup Student',
      })
      .expect(200);

    expect(profileResponse.body.fullName).toBe('Updated Signup Student');
  });

  it('supports login and safe refresh rotation with replay invalidation', async () => {
    const email = createEmail('login');
    await createUser({
      email,
      fullName: 'Login Student',
      password: 'StudyHard@123',
      userType: UserType.STUDENT,
    });

    const loginResponse = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'StudyHard@123',
      })
      .expect(200);

    const oldAccessToken = loginResponse.body.tokens.accessToken as string;
    const oldRefreshToken = loginResponse.body.tokens.refreshToken as string;
    const oldSessionId = loginResponse.body.tokens.sessionId as string;

    const refreshResponse = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: oldRefreshToken,
      })
      .expect(200);

    const newAccessToken = refreshResponse.body.tokens.accessToken as string;
    const newRefreshToken = refreshResponse.body.tokens.refreshToken as string;
    const newSessionId = refreshResponse.body.tokens.sessionId as string;

    expect(newSessionId).not.toBe(oldSessionId);

    await request(httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .expect(401);

    await request(httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);

    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: oldRefreshToken,
      })
      .expect(401);

    await request(httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(401);

    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: newRefreshToken,
      })
      .expect(401);
  });

  it('revokes the current session on logout', async () => {
    const email = createEmail('logout');
    await createUser({
      email,
      fullName: 'Logout Student',
      password: 'StudyHard@123',
      userType: UserType.STUDENT,
    });

    const loginResponse = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'StudyHard@123',
      })
      .expect(200);

    const accessToken = loginResponse.body.tokens.accessToken as string;

    await request(httpServer)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('allows an authenticated admin to create a student account', async () => {
    const adminEmail = createEmail('admin');
    await createUser({
      email: adminEmail,
      fullName: 'Admin User',
      password: 'AdminPassword@123',
      userType: UserType.ADMIN,
    });

    const adminLoginResponse = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: 'AdminPassword@123',
      })
      .expect(200);

    const studentEmail = createEmail('admin-created-student');
    const createStudentResponse = await request(httpServer)
      .post('/api/v1/admin/users/students')
      .set(
        'Authorization',
        `Bearer ${adminLoginResponse.body.tokens.accessToken as string}`,
      )
      .send({
        fullName: 'Admin Created Student',
        email: studentEmail,
        password: 'StudentPassword@123',
      })
      .expect(201);

    expect(createStudentResponse.body.email).toBe(studentEmail);
    expect(createStudentResponse.body.userType).toBe(UserType.STUDENT);

    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email: studentEmail,
        password: 'StudentPassword@123',
      })
      .expect(200);
  });

  function createEmail(prefix: string) {
    emailCounter += 1;
    const email = `${prefix}-${Date.now()}-${emailCounter}@example.com`;
    createdEmails.push(email);
    return email;
  }

  async function createUser(params: {
    email: string;
    fullName: string;
    password: string;
    userType: UserType;
  }) {
    const passwordHash = await passwordHasherService.hash(params.password);

    await prisma.user.create({
      data: {
        siteId: defaultSiteId,
        email: params.email,
        fullName: params.fullName,
        passwordHash,
        userType: params.userType,
        status: UserStatus.ACTIVE,
      },
    });
  }
});
