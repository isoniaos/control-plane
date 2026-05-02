import { ProjectionService } from '../projections/projection.service';
import { createCliApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createCliApp();
  try {
    const requeued = await app.get(ProjectionService).retryFailedEvents();
    const processed = await app.get(ProjectionService).processUntilIdle();
    console.log(
      `Requeued ${requeued} failed projection events and projected ${processed} events.`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
