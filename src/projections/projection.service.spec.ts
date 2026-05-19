import {
  AccountabilityExecutionStatus,
  BodyKind,
  DataStatus,
  GovernanceEventName,
  ObservedTransactionStatus,
  ORGANIZATION_FINALIZATION_STATUSES,
  ProposalStatus,
  ProposalExecutionMode,
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

  it('projects ProposalCreated policyVersion and actionSelector into proposals', async () => {
    const { service, clientQuery } = createProjectionHarness([
      proposalCreatedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const proposalInsert = findSqlCall(clientQuery, 'insert into proposals');
    expect(normalizeSql(proposalInsert[0])).toContain(
      'on conflict (chain_id, org_id, proposal_id) do update',
    );
    expect(normalizeSql(proposalInsert[0])).toContain('action_selector');
    expect(proposalInsert[1][4]).toBe('7');
    expect(proposalInsert[1][8]).toBe('0xa9059cbb');
    expect(proposalInsert[1]).toEqual(
      expect.arrayContaining([
        '42',
        ProposalType.Standard,
        ProposalStatus.Approved,
      ]),
    );
  });

  it('stores a null proposal action selector for legacy ProposalCreated raw events', async () => {
    const { service, clientQuery } = createProjectionHarness([
      legacyProposalCreatedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const proposalInsert = findSqlCall(clientQuery, 'insert into proposals');
    expect(proposalInsert[1][8]).toBeNull();
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
        '0xa9059cbb',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0',
      ]),
    );
    expect(String(accountabilityInsert[1][14])).toContain(
      'target contracts are not decoded',
    );
  });

  it('upserts org executor configuration and preserves zero-address clears', async () => {
    const { service, clientQuery } = createProjectionHarness([
      orgExecutorUpdatedEvent('1'),
      orgExecutorUpdatedEvent('2', {
        previousExecutorAddress: '0x0000000000000000000000000000000000000005',
        newExecutorAddress: '0x0000000000000000000000000000000000000000',
      }),
    ]);

    await expect(service.processBatch(2)).resolves.toBe(2);

    const executorInserts = clientQuery.mock.calls.filter(([sql]) =>
      normalizeSql(sql).includes('insert into org_executors'),
    );
    expect(executorInserts).toHaveLength(2);
    expect(
      normalizeSql(executorInserts[0]?.[0]).includes(
        'on conflict (chain_id, org_id) do update',
      ),
    ).toBe(true);
    expect(executorInserts[1]?.[1]).toEqual([
      '31337',
      '1',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000005',
      '0x0000000000000000000000000000000000000004',
      '0xtx2',
      '16',
      '2',
    ]);
  });

  it('projects a direct canonical proposal execution receipt', async () => {
    const { service, clientQuery } = createProjectionHarness([
      proposalExecutedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const receiptInsert = findSqlCall(
      clientQuery,
      'insert into proposal_execution_receipts',
    );
    expect(receiptInsert[1]).toEqual([
      '31337',
      '1',
      '42',
      '0xtx1',
      '12',
      '0x0000000000000000000000000000000000000004',
      '0x0000000000000000000000000000000000000002',
      '0',
      '0xa9059cbb',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      ProposalExecutionMode.Direct,
      undefined,
      '1',
    ]);
  });

  it('projects a managed canonical proposal execution receipt', async () => {
    const { service, clientQuery } = createProjectionHarness([
      proposalExecutedEvent('1', {
        managedExecutorAddress: '0x0000000000000000000000000000000000000005',
      }),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    const receiptInsert = findSqlCall(
      clientQuery,
      'insert into proposal_execution_receipts',
    );
    expect(receiptInsert[1][10]).toBe(ProposalExecutionMode.Managed);
    expect(receiptInsert[1][11]).toBe(
      '0x0000000000000000000000000000000000000005',
    );
  });

  it('keeps legacy ProposalExecuted projection conservative without inferring receipt fields', async () => {
    const { service, clientQuery } = createProjectionHarness([
      legacyProposalExecutedEvent('1'),
    ]);

    await expect(service.processBatch(1)).resolves.toBe(1);

    expect(
      clientQuery.mock.calls.some(([sql]) =>
        normalizeSql(sql).includes('insert into proposal_execution_receipts'),
      ),
    ).toBe(false);
    const accountabilityInsert = findSqlCall(
      clientQuery,
      'insert into accountability_records',
    );
    expect(accountabilityInsert[1][10]).toBeUndefined();
    expect(accountabilityInsert[1][12]).toBeUndefined();
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

  it('upserts execution target rules idempotently by org and target', async () => {
    const { service, clientQuery } = createProjectionHarness([
      executionTargetRuleUpdatedEvent('1', { maxValue: '1000' }),
      executionTargetRuleUpdatedEvent('2', { maxValue: '2000' }),
    ]);

    await expect(service.processBatch(2)).resolves.toBe(2);

    const targetInserts = clientQuery.mock.calls.filter(([sql]) =>
      normalizeSql(sql).includes('insert into execution_target_rules'),
    );
    expect(targetInserts).toHaveLength(2);
    expect(
      targetInserts.every(([sql]) =>
        normalizeSql(sql).includes(
          'on conflict (chain_id, org_id, target_address) do update',
        ),
      ),
    ).toBe(true);
    expect(targetInserts[1]?.[1]).toEqual([
      '31337',
      '1',
      '0x0000000000000000000000000000000000000002',
      true,
      '2000',
      '14',
      '0xtx2',
      2,
      '0x0000000000000000000000000000000000000004',
    ]);
  });

  it('upserts execution selector rules idempotently by org, target, and selector', async () => {
    const { service, clientQuery } = createProjectionHarness([
      executionSelectorRuleUpdatedEvent('1', { enabled: true }),
      executionSelectorRuleUpdatedEvent('2', { enabled: false }),
    ]);

    await expect(service.processBatch(2)).resolves.toBe(2);

    const selectorInserts = clientQuery.mock.calls.filter(([sql]) =>
      normalizeSql(sql).includes('insert into execution_selector_rules'),
    );
    expect(selectorInserts).toHaveLength(2);
    expect(
      selectorInserts.every(([sql]) =>
        normalizeSql(sql).includes(
          'on conflict (chain_id, org_id, target_address, selector) do update',
        ),
      ),
    ).toBe(true);
    expect(selectorInserts[1]?.[1]).toEqual([
      '31337',
      '1',
      '0x0000000000000000000000000000000000000002',
      '0xa9059cbb',
      false,
      '15',
      '0xtx2',
      2,
      '0x0000000000000000000000000000000000000004',
    ]);
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
      actionSelector: '0xa9059cbb',
      dataHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      metadataUri: 'ipfs://proposal',
    },
  };
}

function legacyProposalCreatedEvent(id: string): TestRawEvent {
  const event = proposalCreatedEvent(id);
  const { actionSelector, ...args } = event.args;
  void actionSelector;
  return {
    ...event,
    args,
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
  overrides: {
    readonly txHash?: string;
    readonly logIndex?: number;
    readonly managedExecutorAddress?: string;
  } = {},
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
      value: '0',
      actionSelector: '0xa9059cbb',
      dataHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      managedExecutorAddress:
        overrides.managedExecutorAddress ??
        '0x0000000000000000000000000000000000000000',
    },
  };
}

function legacyProposalExecutedEvent(id: string): TestRawEvent {
  const event = proposalExecutedEvent(id);
  const { value, actionSelector, managedExecutorAddress, ...args } = event.args;
  void value;
  void actionSelector;
  void managedExecutorAddress;
  return {
    ...event,
    args,
  };
}

function orgExecutorUpdatedEvent(
  id: string,
  overrides: {
    readonly previousExecutorAddress?: string;
    readonly newExecutorAddress?: string;
  } = {},
): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '16',
    tx_hash: `0xtx${id}`,
    log_index: Number(id),
    event_name: GovernanceEventName.OrgExecutorUpdated,
    status: DataStatus.Confirmed,
    block_timestamp: '106',
    args: {
      orgId: '1',
      previousExecutorAddress:
        overrides.previousExecutorAddress ??
        '0x0000000000000000000000000000000000000000',
      newExecutorAddress:
        overrides.newExecutorAddress ??
        '0x0000000000000000000000000000000000000005',
      actorAddress: '0x0000000000000000000000000000000000000004',
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

function executionTargetRuleUpdatedEvent(
  id: string,
  overrides: { readonly enabled?: boolean; readonly maxValue?: string } = {},
): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '14',
    tx_hash: `0xtx${id}`,
    log_index: Number(id),
    event_name: GovernanceEventName.ExecutionTargetRuleUpdated,
    status: DataStatus.Confirmed,
    block_timestamp: '104',
    args: {
      orgId: '1',
      targetAddress: '0x0000000000000000000000000000000000000002',
      enabled: overrides.enabled ?? true,
      maxValue: overrides.maxValue ?? '1000',
      actorAddress: '0x0000000000000000000000000000000000000004',
    },
  };
}

function executionSelectorRuleUpdatedEvent(
  id: string,
  overrides: { readonly enabled?: boolean } = {},
): TestRawEvent {
  return {
    id,
    chain_id: '31337',
    block_number: '15',
    tx_hash: `0xtx${id}`,
    log_index: Number(id),
    event_name: GovernanceEventName.ExecutionSelectorRuleUpdated,
    status: DataStatus.Confirmed,
    block_timestamp: '105',
    args: {
      orgId: '1',
      targetAddress: '0x0000000000000000000000000000000000000002',
      selector: '0xa9059cbb',
      enabled: overrides.enabled ?? true,
      actorAddress: '0x0000000000000000000000000000000000000004',
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
