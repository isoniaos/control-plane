import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { RuntimeHeartbeatService } from './diagnostics/runtime-heartbeat.service';
import {
  CONTROL_PLANE_API_VERSION,
  readServiceVersion,
} from './system/version';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  const logger = new Logger('ControlPlaneApi');
  const packageVersion = readServiceVersion();
  app.enableCors({
    origin:
      config.corsOrigins.length === 1
        ? config.corsOrigins[0]
        : config.corsOrigins,
    credentials: config.corsCredentials,
  });
  await app.listen(config.port);
  app.get(RuntimeHeartbeatService).start('api', () => ({
    port: config.port,
    chainId: config.chainId,
    apiVersion: CONTROL_PLANE_API_VERSION,
    packageVersion,
  }));
  logger.log(
    `API started port=${config.port} chainId=${config.chainId} apiVersion=${CONTROL_PLANE_API_VERSION} packageVersion=${packageVersion}`,
  );
}
void bootstrap();
