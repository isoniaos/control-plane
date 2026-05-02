import { Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { maskUrl } from '../config/safe-url';
import { RuntimeHeartbeatService } from '../diagnostics/runtime-heartbeat.service';
import { IndexerService } from '../indexer/indexer.service';
import { createCliApp } from './bootstrap';

async function main(): Promise<void> {
  const app = await createCliApp();
  const logger = new Logger('IndexerRuntime');
  const config = app.get(AppConfigService);
  const indexer = app.get(IndexerService);
  const fromBlock = await indexer.getNextFromBlock();
  const startupMetadata = {
    chainId: config.chainId,
    rpcUrl: maskUrl(config.rpcUrl),
    govCoreAddress: config.contracts.govCoreAddress ?? null,
    govProposalsAddress: config.contracts.govProposalsAddress ?? null,
    fromBlock: fromBlock.toString(),
    pollingIntervalMs: config.pollIntervalMs,
    safeBlockLag: config.confirmations,
  };

  logger.log(
    `Indexer starting chainId=${startupMetadata.chainId} rpcUrl=${startupMetadata.rpcUrl} govCore=${startupMetadata.govCoreAddress ?? 'not-configured'} govProposals=${startupMetadata.govProposalsAddress ?? 'not-configured'} fromBlock=${startupMetadata.fromBlock} pollingIntervalMs=${startupMetadata.pollingIntervalMs} safeBlockLag=${startupMetadata.safeBlockLag}`,
  );
  app.get(RuntimeHeartbeatService).start('indexer', () => startupMetadata);
  await indexer.runForever();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
