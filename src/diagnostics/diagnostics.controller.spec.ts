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
    } as unknown as DiagnosticsService;
    const controller = new DiagnosticsController(service);

    await expect(controller.getDiagnostics()).resolves.toBe(diagnostics);
    expect(service.getDiagnostics).toHaveBeenCalledTimes(1);
  });
});
