import {
  AccountabilityExecutionStatus,
  BodyKind,
  DataStatus,
  GovernanceEventName,
  ObservedTransactionStatus,
  ORGANIZATION_FINALIZATION_STATUSES,
  ProposalStatus,
  ProposalType,
} from '@isonia/types';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import { ProjectionService } from './projection.service';

interface TestRawEvent extends QueryResultRow {
  readonly id: string;
  readonly chain_id: string;
  readonly block_number: string;
  readonly tx_hash: string;
  readonly log_index: number;
  readonly event_name: GovernanceEventName;
  readonly args: Record<string, unknown>;
  readonly status: DataStatus;
  readonly block_timestamp: string | null;
}

interface ProjectionHarness {
  readonly service: ProjectionService;
  readonly clientQuery: QueryMock;
  readonly dbQuery: QueryMock;
}

type QueryMock = jest.Mock<
  Promise<QueryResult<QueryResultRow>>,
  [sql: string, values?: unknown[]]
>;

describe('ProjectionService', () => {
  it('claims only configured-chain projection rows with FOR UPDATE SKIP LOCKED', async () => {
    const { service, clientQuery } = createProjectionHarness([]);

    await expect(service.processBatch(1)).resolves.toBe(0);

    const selectSql = String(clientQuery.mock.calls[0][0])
      .replace(/\s+/g, ' ')
      .toLowerCase();
    expect(selectSql).toContain('from raw_events');
    expect(selectSql).toContain('where chain_id = $1');
    expect(selectSql).toContain(
      "status = 'confirmed' and processed_at is null",
    );
    expect(selectSql).toContain('failed_at is null');
    expect(selectSql).toContain('for update skip locked');
    expect(clientQuery.mock.calls[0][1]).toEqual([31337]);
  });

  it('requeues failed configured-chain events for manual retry', async () => {
    const { service, dbQuery } = createProjectionHarness([]);

    await expect(service.retryFailedEvents()).resolves.toBe(0);

    const retrySql = normalizeSql(dbQuery.mock.calls[0][0]);
    expect(retrySql).toContain('update raw_events');
    expect(retrySql).toContain('where chain_id = $1');
    expect(retrySql).toContain("status = 'confirmed'");
    expect(retrySql).toContain('processed_at is null');
    expect(retrySql).toContain('failed_at is not null');
    expect(dbQuery.mock.calls[0][1]).toEqual([31337]);
  });

  it('projects ProposalCreated policyVersion into proposals', async () => {
    const { service, clientQuery } = createProjectionHarness([
      proposalCreatedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const proposalInsert = findSqlCall(clientQuery, 'insert into proposals');
    expect(normalizeSql(proposalInsert[0])).toContain(
      'on conflict (chain_id, org_id, proposal_id) do update',
    );
    expect(proposalInsert[1][4]).toBe('7');
    expect(proposalInsert[1]).toEqual(
      expect.arrayContaining([
        '42',
        ProposalType.Standard,
        ProposalStatus.Approved,
      ]),
    );
  });

  it('updates proposal status from ProposalStatusChanged', async () => {
    const { service, clientQuery } = createProjectionHarness([
      proposalStatusChangedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const proposalUpdate = findSqlCall(
      clientQuery,
      'update proposals set status',
    );
    expect(proposalUpdate[1]).toEqual([
      '31337',
      '1',
      '42',
      ProposalStatus.Queued,
    ]);
  });

  it('upserts an accountability record with generic execution proof metadata for ProposalExecuted', async () => {
    const { service, clientQuery } = createProjectionHarness([
      proposalExecutedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const accountabilityInsert = findSqlCall(
      clientQuery,
      'insert into accountability_records',
    );
    expect(accountabilityInsert[1]).toEqual(
      expect.arrayContaining([
        '31337',
        '1',
        '42',
        'accountability:31337:1:42',
        'decision:31337:1:42',
        AccountabilityExecutionStatus.Completed,
        '0xtx1',
        ObservedTransactionStatus.Confirmed,
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0',
      ]),
    );
    expect(String(accountabilityInsert[1][14])).toContain(
      'target contracts are not decoded',
    );
  });

  it('projects OrganizationFinalized without changing organization active status', async () => {
    const { service, clientQuery } = createProjectionHarness([
      organizationFinalizedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const organizationUpdate = findSqlCall(
      clientQuery,
      'update organizations set finalization_status',
    );
    expect(organizationUpdate[1]).toEqual([
      '31337',
      '1',
      ORGANIZATION_FINALIZATION_STATUSES.Finalized,
      '0x000000000000000000000000000000000000000a',
      '12',
      '0xtx1',
      '102',
    ]);
    expect(normalizeSql(organizationUpdate[0])).not.toContain('set status');
  });

  it('keeps duplicate projection attempts idempotent through org-scoped upserts', async () => {
    const { service, clientQuery } = createProjectionHarness([
      proposalCreatedEvent('1'),
      proposalCreatedEvent('2'),
    ]);

    await expect(service.processBatch(2)).resolves.toBe(2);

    const proposalInserts = clientQuery.mock.calls.filter(([sql]) =>
      normalizeSql(sql).includes('insert into proposals'),
    );
    expect(proposalInserts).toHaveLength(2);
    expect(
      proposalInserts.every(([sql]) =>
        normalizeSql(sql).includes(
          'on conflict (chain_id, org_id, proposal_id) do update',
        ),
      ),
    ).toBe(true);
  });

  it('projects every BodyCreated event emitted by one batch transaction', async () => {
    const { service, clientQuery } = createProjectionHarness([
      bodyCreatedEvent('1', '1', 4),
      bodyCreatedEvent('2', '2', 5),
      bodyCreatedEvent('3', '3', 6),
    ]);

    await expect(service.processBatch(3)).resolves.toBe(3);

    const bodyInserts = clientQuery.mock.calls.filter(([sql]) =>
      normalizeSql(sql).includes('insert into bodies'),
    );
    expect(bodyInserts).toHaveLength(3);
    expect(bodyInserts.map(([, values]) => values?.[1])).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(
      bodyInserts.every(
        ([, values]) => values?.[3] === BodyKind.GeneralCouncil,
      ),
    ).toBe(true);
  });
});

function createProjectionHarness(events: TestRawEvent[]): ProjectionHarness {
  const pendingEvents = [...events];
  const clientQuery: QueryMock = jest.fn((sql: string, values?: unknown[]) => {
    const normalized = normalizeSql(sql);
    if (
      normalized.includes('from raw_events') &&
      normalized.includes('processed_at is null')
    ) {
      const event = pendingEvents.shift();
      return Promise.resolve(queryResult(event ? [event] : []));
    }
    if (normalized.includes('from policy_rules')) {
      return Promise.resolve(queryResult([{ required_approval_bodies: [] }]));
    }
    if (normalized.includes('from proposals')) {
      return Promise.resolve(queryResult([{ value: '0' }]));
    }
    return Promise.resolve(queryResult([], values));
  });
  const client = { query: clientQuery } as unknown as PoolClient;
  const dbQuery: QueryMock = jest.fn((sql: string, values?: unknown[]) => {
    void sql;
    void values;
    return Promise.resolve(queryResult([]));
  });
  const db = {
    transaction: jest.fn(
      (work: (transactionClient: PoolClient) => Promise<unknown>) =>
        work(client),
    ),
    query: dbQuery,
  } as unknown as DatabaseService;

  const config = { chainId: 31337 } as AppConfigService;

  return { service: new ProjectionService(db, config), clientQuery, dbQuery };
}

function proposalCreatedEvent(id: string): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '10',
    tx_hash: `0xtx${id}`,
    log_index: Number(id),
    event_name: GovernanceEventName.ProposalCreated,
    status: DataStatus.Confirmed,
    block_timestamp: '100',
    args: {
      orgId: '1',
      proposalId: '42',
      proposalType: ProposalType.Standard,
      policyVersion: '7',
      creatorAddress: '0x0000000000000000000000000000000000000001',
      targetAddress: '0x0000000000000000000000000000000000000002',
      value: '0',
      dataHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      metadataUri: 'ipfs://proposal',
    },
  };
}

function proposalStatusChangedEvent(id: string): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '11',
    tx_hash: `0xtx${id}`,
    log_index: Number(id),
    event_name: GovernanceEventName.ProposalStatusChanged,
    status: DataStatus.Confirmed,
    block_timestamp: '101',
    args: {
      orgId: '1',
      proposalId: '42',
      previousStatus: ProposalStatus.Approved,
      newStatus: ProposalStatus.Queued,
    },
  };
}

function proposalExecutedEvent(
  id: string,
  overrides: { readonly txHash?: string; readonly logIndex?: number } = {},
): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '12',
    tx_hash: overrides.txHash ?? `0xtx${id}`,
    log_index: overrides.logIndex ?? Number(id),
    event_name: GovernanceEventName.ProposalExecuted,
    status: DataStatus.Confirmed,
    block_timestamp: '102',
    args: {
      orgId: '1',
      proposalId: '42',
      executorAddress: '0x0000000000000000000000000000000000000004',
      targetAddress: '0x0000000000000000000000000000000000000002',
      dataHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
  };
}

function organizationFinalizedEvent(id: string): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '12',
    tx_hash: `0xtx${id}`,
    log_index: Number(id),
    event_name: GovernanceEventName.OrganizationFinalized,
    status: DataStatus.Confirmed,
    block_timestamp: '102',
    args: {
      orgId: '1',
      admin: '0x000000000000000000000000000000000000000a',
    },
  };
}

function bodyCreatedEvent(
  id: string,
  bodyId: string,
  logIndex: number,
): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '13',
    tx_hash: '0xbatchbodies',
    log_index: logIndex,
    event_name: GovernanceEventName.BodyCreated,
    status: DataStatus.Confirmed,
    block_timestamp: '103',
    args: {
      orgId: '1',
      bodyId,
      kind: BodyKind.GeneralCouncil,
      metadataUri: '',
    },
  };
}

function findSqlCall(query: QueryMock, needle: string): [string, unknown[]] {
  const call = query.mock.calls.find(([sql]) =>
    normalizeSql(sql).includes(needle),
  );
  if (!call) {
    throw new Error(`SQL call not found: ${needle}`);
  }
  const [sql, values = []] = call;
  return [sql, values];
}

function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').toLowerCase();
}

function queryResult<T extends QueryResultRow>(
  rows: T[],
  values?: unknown[],
): QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
    values,
  } as unknown as QueryResult<T>;
}
