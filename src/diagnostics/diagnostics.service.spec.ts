import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import {
  GovernanceEventName,
  ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES,
} from '@isonia/types';
import {
  RuntimeHeartbeatService,
  type RuntimeProcessHeartbeatDto,
  type RuntimeProcessName,
} from './runtime-heartbeat.service';
import { DiagnosticsService } from './diagnostics.service';

interface QueryResultStub {
  readonly rows: Record<string, unknown>[];
}

type QueryMock = jest.Mock<
  Promise<QueryResultStub>,
  [sql: string, values?: unknown[]]
>;

type GetProcessesMock = jest.Mock<
  Promise<RuntimeProcessHeartbeatDto[]>,
  [processNames: readonly RuntimeProcessName[]]
>;

describe('DiagnosticsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the v0.5 diagnostics response shape', async () => {
    const { service } = createService();
    jest
      .spyOn(
        service as unknown as {
          getLatestChainBlockOrUndefined(): Promise<bigint | undefined>;
        },
        'getLatestChainBlockOrUndefined',
      )
      .mockResolvedValue(120n);

    const diagnostics = await service.getDiagnostics();

    expect(typeof diagnostics.generatedAt).toBe('string');
    expect(diagnostics).toEqual({
      apiVersion: 'v1',
      chainId: 31337,
      confirmations: 5,
      contracts: [
        {
          name: 'govCore',
          configured: true,
          address: '0x0000000000000000000000000000000000000001',
        },
        {
          name: 'govProposals',
          configured: true,
          address: '0x0000000000000000000000000000000000000002',
        },
      ],
      latestChainBlock: '120',
      latestSafeBlock: '115',
      lastScannedBlocks: [
        {
          contractName: 'govCore',
          address: '0x0000000000000000000000000000000000000001',
          lastScannedBlock: '100',
          lastConfirmedBlock: '100',
          updatedAt: '2026-04-29T12:00:00.000Z',
          lagFromSafeBlock: '15',
        },
        {
          contractName: 'govProposals',
          address: '0x0000000000000000000000000000000000000002',
        },
      ],
      rawEventCounts: {
        observed: 0,
        confirmed: 2,
        processed: 3,
        failed: 1,
        orphaned: 0,
      },
      projectionBacklog: 2,
      failedProjectionCount: 1,
      latestProjectionError: {
        rawEventId: '9',
        chainId: 31337,
        contractAddress: '0x0000000000000000000000000000000000000001',
        blockNumber: '99',
        txHash: '0xabc',
        logIndex: 4,
        eventName: 'ProposalCreated',
        error: 'Missing event argument: orgId',
        failedAt: '2026-04-29T12:05:00.000Z',
        processingAttempts: 2,
      },
      protocol: {
        evmContractsVersion: 'v0.7.0-alpha.3',
        finalization: {
          eventName: GovernanceEventName.OrganizationFinalized,
          eventDecodingSupported: true,
          status: ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Supported,
          rawEventCount: 2,
          projectedEventCount: 1,
          emergencyRecoverySupported: false,
          governanceControlledPostFinalizationMutationSupported: false,
        },
      },
      staleDataIndicators: [
        {
          code: 'indexer_behind_safe_block',
          severity: 'warning',
          message: 'govCore indexer cursor is behind the latest safe block.',
          contractName: 'govCore',
          contractAddress: '0x0000000000000000000000000000000000000001',
          lastScannedBlock: '100',
          latestSafeBlock: '115',
          lagBlocks: '15',
        },
        {
          code: 'contract_cursor_missing',
          severity: 'warning',
          message: 'govProposals has not been scanned yet.',
          contractName: 'govProposals',
          contractAddress: '0x0000000000000000000000000000000000000002',
          latestSafeBlock: '115',
        },
        {
          code: 'projection_backlog',
          severity: 'warning',
          message: 'Confirmed raw events are waiting to be projected.',
        },
        {
          code: 'projection_failures',
          severity: 'error',
          message: 'One or more raw events failed projection processing.',
        },
      ],
      generatedAt: diagnostics.generatedAt,
    });
  });

  it('builds indexer diagnostics with runtime process state', async () => {
    const { service, getProcesses } = createService();
    jest
      .spyOn(
        service as unknown as {
          getLatestChainBlockOrUndefined(): Promise<bigint | undefined>;
        },
        'getLatestChainBlockOrUndefined',
      )
      .mockResolvedValue(120n);

    const diagnostics = await service.getIndexerDiagnostics();

    expect(typeof diagnostics.generatedAt).toBe('string');
    expect(getProcesses).toHaveBeenCalledWith([
      'api',
      'indexer',
      'projections',
    ]);
    expect(diagnostics).toEqual({
      apiVersion: 'v1',
      chainId: 31337,
      generatedAt: diagnostics.generatedAt,
      runtime: {
        staleAfterMs: 30000,
        processes: [
          {
            processName: 'indexer',
            status: 'running',
            lastSeenAt: '2026-04-29T12:00:00.000Z',
            ageMs: 100,
            metadata: {},
          },
        ],
      },
      indexer: {
        rpcUrl: 'http://127.0.0.1:8545/',
        contracts: [
          {
            name: 'govCore',
            configured: true,
            address: '0x0000000000000000000000000000000000000001',
          },
          {
            name: 'govProposals',
            configured: true,
            address: '0x0000000000000000000000000000000000000002',
          },
        ],
        fromBlock: '101',
        pollingIntervalMs: 5000,
        safeBlockLag: 5,
        latestChainBlock: '120',
        latestSafeBlock: '115',
        lastScannedBlocks: diagnostics.indexer.lastScannedBlocks,
        rawEventCounts: {
          observed: 0,
          confirmed: 2,
          processed: 3,
          failed: 1,
          orphaned: 0,
        },
        staleDataIndicators: [
          {
            code: 'indexer_behind_safe_block',
            severity: 'warning',
            message: 'govCore indexer cursor is behind the latest safe block.',
            contractName: 'govCore',
            contractAddress: '0x0000000000000000000000000000000000000001',
            lastScannedBlock: '100',
            latestSafeBlock: '115',
            lagBlocks: '15',
          },
          {
            code: 'contract_cursor_missing',
            severity: 'warning',
            message: 'govProposals has not been scanned yet.',
            contractName: 'govProposals',
            contractAddress: '0x0000000000000000000000000000000000000002',
            latestSafeBlock: '115',
          },
        ],
      },
      projections: {
        store: 'postgres://***:***@localhost:5432/control-plane',
        pollingIntervalMs: 5000,
        lastProjectedCursor: {
          blockNumber: '100',
          txHash: '0xtx',
          logIndex: 3,
          processedAt: '2026-04-29T12:01:00.000Z',
        },
        projectionBacklog: 2,
        failedProjectionCount: 1,
        latestProjectionError: {
          rawEventId: '9',
          chainId: 31337,
          contractAddress: '0x0000000000000000000000000000000000000001',
          blockNumber: '99',
          txHash: '0xabc',
          logIndex: 4,
          eventName: 'ProposalCreated',
          error: 'Missing event argument: orgId',
          failedAt: '2026-04-29T12:05:00.000Z',
          processingAttempts: 2,
        },
      },
    });
  });
});

function createService(): {
  service: DiagnosticsService;
  query: QueryMock;
  runtimeHeartbeats: RuntimeHeartbeatService;
  getProcesses: GetProcessesMock;
} {
  const query: QueryMock = jest.fn((sql: string, values?: unknown[]) => {
    const normalized = normalizeSql(sql);
    if (normalized.includes('select block_number, tx_hash, log_index')) {
      return Promise.resolve({
        rows: [
          {
            block_number: '100',
            tx_hash: '0xtx',
            log_index: 3,
            processed_at: new Date('2026-04-29T12:01:00.000Z'),
          },
        ],
      });
    }
    if (normalized.includes('from chain_cursors')) {
      return Promise.resolve({
        rows: [
          {
            contract_address: '0x0000000000000000000000000000000000000001',
            last_scanned_block: '100',
            last_confirmed_block: '100',
            updated_at: new Date('2026-04-29T12:00:00.000Z'),
          },
        ],
      });
    }
    if (normalized.includes('status_bucket')) {
      return Promise.resolve({
        rows: [
          { status: 'confirmed', count: 2 },
          { status: 'processed', count: 3 },
          { status: 'failed', count: 1 },
        ],
      });
    }
    if (normalized.includes('projectionbacklog')) {
      return Promise.resolve({
        rows: [{ projectionBacklog: 2, failedProjectionCount: 1 }],
      });
    }
    if (normalized.includes('raweventcount')) {
      return Promise.resolve({
        rows: [{ rawEventCount: 2, projectedEventCount: 1 }],
      });
    }
    if (normalized.includes('order by failed_at')) {
      if (values?.[1] === GovernanceEventName.OrganizationFinalized) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({
        rows: [
          {
            id: '9',
            chain_id: '31337',
            contract_address: '0x0000000000000000000000000000000000000001',
            block_number: '99',
            tx_hash: '0xabc',
            log_index: 4,
            event_name: 'ProposalCreated',
            error: 'Missing event argument: orgId',
            failed_at: new Date('2026-04-29T12:05:00.000Z'),
            processing_attempts: 2,
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  });
  const db = { query } as unknown as DatabaseService;
  const config = {
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 31337,
    confirmations: 5,
    pollIntervalMs: 5000,
    startBlock: 0n,
    databaseUrl: 'postgres://postgres:secret@localhost:5432/control-plane',
    contractAddresses: [
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
    ],
    contracts: {
      govCoreAddress: '0x0000000000000000000000000000000000000001',
      govProposalsAddress: '0x0000000000000000000000000000000000000002',
    },
    evmContractsVersion: 'v0.7.0-alpha.3',
  } as unknown as AppConfigService;
  const getProcesses: GetProcessesMock = jest.fn(
    (processNames: readonly RuntimeProcessName[]) => {
      void processNames;
      return Promise.resolve([
        {
          processName: 'indexer',
          status: 'running',
          lastSeenAt: '2026-04-29T12:00:00.000Z',
          ageMs: 100,
          metadata: {},
        },
      ]);
    },
  );
  const runtimeHeartbeats = {
    staleAfterMs: 30000,
    getProcesses,
  } as unknown as RuntimeHeartbeatService;

  return {
    service: new DiagnosticsService(config, db, runtimeHeartbeats),
    query,
    runtimeHeartbeats,
    getProcesses,
  };
}

function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').toLowerCase();
}
