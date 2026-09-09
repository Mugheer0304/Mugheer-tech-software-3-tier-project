import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './common/config';
import { JsonRpcExceptionFilter } from './common/filters/json-rpc-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(helmet({
    contentSecurityPolicy: false, // serve API only; frontend has its own CSP
  }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.corsOrigin.split(','),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new JsonRpcExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // OpenAPI/Swagger — spec Section 15 (published client API contract)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mugheer Platform API')
    .setDescription(
      'Mugheer — the software house platform. Build, monitor, automate. ' +
        'JWT auth: login at /auth/login, then send `Authorization: Bearer <accessToken>`.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication, 2FA, API keys')
    .addTag('projects', 'Products, quotes, design review, deployments')
    .addTag('monitoring', 'Metrics, dashboards, alerts')
    .addTag('automation', 'Runbooks (trigger → condition → action)')
    .addTag('billing', 'Invoices, subscriptions, refunds')
    .addTag('tickets', 'Support tickets with AI triage drafts')
    .addTag('ai', 'AI scoping/code-assist + governance logs')
    .addTag('admin', 'Platform administration')
    .addTag('health', 'Liveness/readiness probes')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/public' });

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Mugheer backend-core listening on :${config.port} (env=${config.env})`);
  logger.log(`API docs: http://localhost:${config.port}/api/docs`);
}

bootstrap();
