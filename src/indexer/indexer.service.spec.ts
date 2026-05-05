import { GovernanceEventName } from '@isonia/types';
import { type Log } from 'viem';
import { type DecodedGovernanceLog } from '../chain/governance-events';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import { IndexerService } from './indexer.service';

type IndexedLog = Log & {
  readonly blockNumber: bigint;
  readonly blockHash: `0x${string}`;
  readonly transactionHash: `0x${string}`;
  readonly logIndex: number;
};

interface QueryResultStub {
  readonly rowCount: number;
  readonly rows: Record<string, unknown>[];
}

type QueryMock = jest.Mock<
  Promise<QueryResultStub>,
  [sql: string, values?: unknown[]]
>;

describe('IndexerService', () => {
  it('deduplicates raw events by logical event identity', async () => {
    const query: QueryMock = jest
      .fn<Promise<QueryResultStub>, [sql: string, values?: unknown[]]>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const db = { query } as unknown as DatabaseService;
    const config = {
      rpcUrl: 'http://127.0.0.1:8545',
      chainId: 31337,
      confirmations: 0,
    } as AppConfigService;
    const service = new IndexerService(config, db);
    const serviceWithPrivate = service as unknown as {
      insertRawEvent(
        log: IndexedLog,
        decoded: DecodedGovernanceLog,
        blockTimestamp: string,
      ): Promise<number>;
    };
    const insertRawEvent = (
      eventLog: IndexedLog,
      decodedLog: DecodedGovernanceLog,
      blockTimestamp: string,
    ) =>
      serviceWithPrivate.insertRawEvent(eventLog, decodedLog, blockTimestamp);
    const log = {
      address: '0x0000000000000000000000000000000000000001',
      blockNumber: 10n,
      blockHash: '0xblock',
      transactionHash: '0xtx',
      logIndex: 2,
      topics: [],
      data: '0x',
    } as unknown as IndexedLog;
    const decoded: DecodedGovernanceLog = {
      eventName: GovernanceEventName.OrganizationCreated,
      args: {
        orgId: '1',
        slug: 'alpha',
        adminAddress: '0x0000000000000000000000000000000000000002',
        metadataUri: 'ipfs://org',
      },
    };

    await expect(insertRawEvent(log, decoded, '100')).resolves.toBe(1);
    await expect(insertRawEvent(log, decoded, '100')).resolves.toBe(0);

    const firstCall = query.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected insert query to be called');
    }
    const insertSql = String(firstCall[0]).replace(/\s+/g, ' ').toLowerCase();
    expect(insertSql).toContain(
      'on conflict (chain_id, tx_hash, log_index) do nothing',
    );
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        31337,
        '0x0000000000000000000000000000000000000001',
      ]),
    );
  });
});
