import { DatabaseService } from '../database/database.service';
import { createCliApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createCliApp();
  try {
    await app.get(DatabaseService).resetAll();
    console.log('Control-plane database tables were reset.');
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
