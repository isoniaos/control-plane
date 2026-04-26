import { IndexerService } from '../indexer/indexer.service';
import { createCliApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createCliApp();
  try {
    const result = await app.get(IndexerService).runOnce();
    if (!result) {
      console.log('No safe blocks to index.');
      return;
    }
    console.log(
      `Indexed ${result.inserted} events from blocks ${result.fromBlock.toString()}-${result.toBlock.toString()}.`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
