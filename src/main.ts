import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { join } from 'path';
import { winstonLogger } from './common/logger/winston.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  // Security Middlewares & Static File Access
  app.use(helmet({ 
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
  }));
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const adminDist = join(process.cwd(), 'public', 'admin');
  app.use('/admin', express.static(adminDist));
  app.use('/admin/*', (req: express.Request, res: express.Response) => {
    res.sendFile(join(adminDist, 'index.html'));
  });
  
  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefixes and API versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Exception Filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Interceptors (Wraps API success data in { success: true, data })
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Documentation configuration
  const config = new DocumentBuilder()
    .setTitle('Laundry Management System API')
    .setDescription('Enterprise laundry business management backend APIs with authentication, workflow tracking, payments, and reporting.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT Token',
        in: 'header',
      },
      'bearer', // This matches the security schema key 'bearer' in @ApiBearerAuth()
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  winstonLogger.log(`Laundry API is running on: http://localhost:${port}/api/v1`);
  winstonLogger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();
