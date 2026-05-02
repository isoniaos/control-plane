import { Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { maskUrl } from '../config/safe-url';
import { RuntimeHeartbeatService } from '../diagnostics/runtime-heartbeat.service';
import { ProjectionService } from '../projections/projection.service';
import { createCliApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createCliApp();
  const logger = new Logger('ProjectionRuntime');
  const config = app.get(AppConfigService);
  const projections = app.get(ProjectionService);
  const store = maskUrl(config.databaseUrl);
  const lastProjectedCursor = await projections.getLastProjectedCursor();
  const startupMetadata = {
    projectionStore: store,
    pollingIntervalMs: config.pollIntervalMs,
    lastProjectedCursor: formatCursor(lastProjectedCursor),
  };

  logger.log(
    `Projection worker starting projectionStore=${startupMetadata.projectionStore} pollingIntervalMs=${startupMetadata.pollingIntervalMs} lastProjectedCursor=${startupMetadata.lastProjectedCursor}`,
  );
  app.get(RuntimeHeartbeatService).start('projections', async () => ({
    projectionStore: store,
    pollingIntervalMs: config.pollIntervalMs,
    lastProjectedCursor: formatCursor(
      await projections.getLastProjectedCursor(),
    ),
  }));

  for (;;) {
    try {
      await projections.processUntilIdle();
    } catch (error) {
      logger.error(`Projection loop failed: ${formatError(error)}`);
    }
    await sleep(config.pollIntervalMs);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCursor(
  cursor: Awaited<ReturnType<ProjectionService['getLastProjectedCursor']>>,
): string {
  if (!cursor) {
    return 'none';
  }
  return `${cursor.blockNumber}:${cursor.logIndex}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
