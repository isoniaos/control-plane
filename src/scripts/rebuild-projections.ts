import { ProjectionService } from '../projections/projection.service';
import { createCliApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createCliApp();
  try {
    const processed = await app.get(ProjectionService).rebuild();
    console.log(`Rebuilt projections from ${processed} events.`);
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
