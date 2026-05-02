import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  app.enableCors({
    origin:
      config.corsOrigins.length === 1
        ? config.corsOrigins[0]
        : config.corsOrigins,
    credentials: config.corsCredentials,
  });
  await app.listen(config.port);
}
bootstrap();
