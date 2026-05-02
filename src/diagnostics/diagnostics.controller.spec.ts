import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';

describe('DiagnosticsController', () => {
  it('returns diagnostics from the service', async () => {
    const diagnostics = {
      apiVersion: 'v1',
      chainId: 31337,
      confirmations: 0,
      contracts: [],
      lastScannedBlocks: [],
      rawEventCounts: {
        observed: 0,
        confirmed: 0,
        processed: 0,
        failed: 0,
        orphaned: 0,
      },
      projectionBacklog: 0,
      failedProjectionCount: 0,
      staleDataIndicators: [],
      generatedAt: '2026-04-29T12:00:00.000Z',
    };
    const service = {
      getDiagnostics: jest.fn().mockResolvedValue(diagnostics),
      getIndexerDiagnostics: jest.fn(),
    } as unknown as DiagnosticsService;
    const controller = new DiagnosticsController(service);

    await expect(controller.getDiagnostics()).resolves.toBe(diagnostics);
    expect(service.getDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('returns indexer diagnostics from the service', async () => {
    const diagnostics = {
      apiVersion: 'v1',
      chainId: 31337,
      generatedAt: '2026-04-29T12:00:00.000Z',
      runtime: {
        staleAfterMs: 30000,
        processes: [],
      },
      indexer: {
        rpcUrl: 'http://127.0.0.1:8545/',
        contracts: [],
        fromBlock: '0',
        pollingIntervalMs: 5000,
        safeBlockLag: 0,
        lastScannedBlocks: [],
        rawEventCounts: {
          observed: 0,
          confirmed: 0,
          processed: 0,
          failed: 0,
          orphaned: 0,
        },
        staleDataIndicators: [],
      },
      projections: {
        store: 'postgres://***:***@localhost:5432/control-plane',
        pollingIntervalMs: 5000,
        lastProjectedCursor: null,
        projectionBacklog: 0,
        failedProjectionCount: 0,
      },
    };
    const service = {
      getDiagnostics: jest.fn(),
      getIndexerDiagnostics: jest.fn().mockResolvedValue(diagnostics),
    } as unknown as DiagnosticsService;
    const controller = new DiagnosticsController(service);

    await expect(controller.getIndexerDiagnostics()).resolves.toBe(diagnostics);
    expect(service.getIndexerDiagnostics).toHaveBeenCalledTimes(1);
  });
});
