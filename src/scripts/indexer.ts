import { IndexerService } from '../indexer/indexer.service';
import { createCliApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createCliApp();
  await app.get(IndexerService).runForever();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
