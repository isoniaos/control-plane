import {
  DataStatus,
  DecisionType,
  ORGANIZATION_FINALIZATION_STATUSES,
  ORGANIZATION_LIFECYCLE_STATUSES,
  OrganizationStatus,
  POST_FINALIZATION_BLOCKED_BOOTSTRAP_ADMIN_OPERATIONS,
  ProposalStatus,
  ProposalType,
  RouteBlockedReasonCode,
} from '@isonia/types';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import { ReadModelsService } from './read-models.service';

interface RouteFixture {
  readonly proposal?: Record<string, unknown>;
  readonly policy?: Record<string, unknown> | null;
  readonly decisions?: readonly Record<string, unknown>[];
  readonly bodies?: readonly Record<string, unknown>[];
}

interface QueryResultStub {
  readonly rows: Record<string, unknown>[];
}

type QueryMock = jest.Mock<
  Promise<QueryResultStub>,
  [sql: string, params?: unknown[]]
>;

describe('ReadModelsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an empty policy list when an org has no current policies', async () => {
    const { service } = createPolicyListService([]);

    await expect(service.getPolicies('1')).resolves.toEqual([]);
  });

  it('returns multiple current policy rules for an org', async () => {
    const { service } = createPolicyListService([
      currentPolicy({
        proposalType: ProposalType.Standard,
        version: '2',
        required_approval_bodies: [1, '2'],
        veto_bodies: ['9'],
        executor_body: '3',
        timelock_seconds: '60',
        enabled: true,
      }),
      currentPolicy({
        proposalType: ProposalType.Treasury,
        version: '5',
        required_approval_bodies: ['4'],
        veto_bodies: [],
        executor_body: null,
        timelock_seconds: '3600',
        enabled: false,
      }),
    ]);

    await expect(service.getPolicies('1')).resolves.toEqual([
      {
        chainId: 31337,
        orgId: '1',
        proposalType: ProposalType.Standard,
        version: '2',
        requiredApprovalBodies: ['1', '2'],
        vetoBodies: ['9'],
        executorBody: '3',
        timelockSeconds: '60',
        enabled: true,
        dataStatus: DataStatus.Confirmed,
      },
      {
        chainId: 31337,
        orgId: '1',
        proposalType: ProposalType.Treasury,
        version: '5',
        requiredApprovalBodies: ['4'],
        vetoBodies: [],
        timelockSeconds: '3600',
        enabled: false,
        dataStatus: DataStatus.Confirmed,
      },
    ]);
  });

  it('isolates policy lists by org_id', async () => {
    const { service, query } = createPolicyListService([
      currentPolicy({ orgId: '1', proposalType: ProposalType.Standard }),
      currentPolicy({ orgId: '2', proposalType: ProposalType.Treasury }),
    ]);

    const policies = await service.getPolicies('1');

    expect(policies).toHaveLength(1);
    expect(policies[0]?.orgId).toBe('1');
    expect(policies[0]?.proposalType).toBe(ProposalType.Standard);
    expect(query).toHaveBeenCalledWith(expect.any(String), ['1']);
    expect(normalizeSql(query.mock.calls[0]?.[0])).toContain(
      'from current_policy_rules where org_id = $1',
    );
  });

  it('reports a missing policy snapshot in proposal route explanations', async () => {
    const { service } = createRouteService({
      policy: null,
      bodies: [],
      decisions: [],
    });

    const route = await service.getProposalRoute('1', '42');

    expect(route?.execution.executable).toBe(false);
    expect(route?.execution.blockedReasons).toContainEqual({
      code: RouteBlockedReasonCode.PolicySnapshotMissing,
      message: 'Proposal policy snapshot is missing from projections.',
    });
  });

  it('filters proposal decisions by org_id', async () => {
    const { service, query } = createRouteService({
      decisions: [approvalDecision('1')],
      bodies: [{ body_id: '1', name: 'Council' }],
    });

    await service.getProposalRoute('1', '42');

    const decisionCall = query.mock.calls.find(([sql]) =>
      normalizeSql(sql).includes('from proposal_decisions'),
    );
    expect(normalizeSql(decisionCall?.[0])).toContain(
      'where chain_id = $1 and org_id = $2 and proposal_id = $3',
    );
    expect(decisionCall?.[1]).toEqual(['31337', '1', '42']);
  });

  it('reports missing approvals', async () => {
    const { service } = createRouteService({
      policy: policy({ required_approval_bodies: ['1', '2'] }),
      decisions: [approvalDecision('1')],
      bodies: [
        { body_id: '1', name: 'Council' },
        { body_id: '2', name: 'Treasury' },
      ],
    });

    const route = await service.getProposalRoute('1', '42');

    expect(route?.execution.executable).toBe(false);
    expect(route?.execution.blockedReasons).toContainEqual({
      code: RouteBlockedReasonCode.MissingApproval,
      message: 'Missing approval from Treasury.',
      relatedBodyId: '2',
    });
  });

  it('reports vetoed routes', async () => {
    const { service } = createRouteService({
      policy: policy({ veto_bodies: ['9'] }),
      decisions: [approvalDecision('1'), vetoDecision('9')],
      bodies: [
        { body_id: '1', name: 'Council' },
        { body_id: '9', name: 'Security' },
      ],
    });

    const route = await service.getProposalRoute('1', '42');

    expect(route?.execution.executable).toBe(false);
    expect(route?.execution.blockedReasons).toContainEqual({
      code: RouteBlockedReasonCode.Vetoed,
      message: 'Proposal was vetoed by Security.',
      relatedBodyId: '9',
    });
  });

  it('reports approved proposals that still need to be queued', async () => {
    const { service } = createRouteService({
      policy: policy({ timelock_seconds: '60' }),
      decisions: [approvalDecision('1')],
      bodies: [{ body_id: '1', name: 'Council' }],
    });

    const route = await service.getProposalRoute('1', '42');

    expect(route?.execution.executable).toBe(false);
    expect(route?.execution.blockedReasons).toContainEqual({
      code: RouteBlockedReasonCode.NotQueued,
      message: 'Proposal must be queued before execution.',
    });
  });

  it('reports queued proposals whose timelock has not elapsed', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000);
    const { service } = createRouteService({
      proposal: proposal({
        status: ProposalStatus.Queued,
        queued_at_chain: '999900',
        executable_at_chain: '1000100',
      }),
      policy: policy({ timelock_seconds: '60' }),
      decisions: [approvalDecision('1')],
      bodies: [{ body_id: '1', name: 'Council' }],
    });

    const route = await service.getProposalRoute('1', '42');

    expect(route?.timelock.satisfied).toBe(false);
    expect(route?.execution.executable).toBe(false);
    expect(route?.execution.blockedReasons).toContainEqual({
      code: RouteBlockedReasonCode.TimelockNotSatisfied,
      message: 'Timelock has not elapsed.',
    });
  });

  it('marks routes executable when approvals are complete and no blockers remain', async () => {
    const { service } = createRouteService({
      decisions: [approvalDecision('1')],
      bodies: [{ body_id: '1', name: 'Council' }],
    });

    const route = await service.getProposalRoute('1', '42');

    expect(route?.execution.executable).toBe(true);
    expect(route?.execution.blockedReasons).toEqual([]);
  });

  it('returns finalization read metadata for finalized active organizations', async () => {
    const { service } = createFinalizationService(
      {
        orgId: '1',
        organizationStatus: OrganizationStatus.Active,
        storedFinalizationStatus: ORGANIZATION_FINALIZATION_STATUSES.Finalized,
        finalizedBy: '0x000000000000000000000000000000000000000a',
        finalizedBlock: '123',
        finalizedTxHash: '0xtx',
        finalizedAt: '1000',
      },
      'v0.7.0-alpha.3',
    );

    await expect(service.getOrganizationFinalization('1')).resolves.toEqual({
      orgId: '1',
      organizationStatus: OrganizationStatus.Active,
      lifecycleStatus: ORGANIZATION_LIFECYCLE_STATUSES.Finalized,
      finalizationStatus: ORGANIZATION_FINALIZATION_STATUSES.Finalized,
      finalized: true,
      bootstrapAdminMutationsAllowed: false,
      blockedBootstrapAdminOperations:
        POST_FINALIZATION_BLOCKED_BOOTSTRAP_ADMIN_OPERATIONS,
      derived: {
        activeAndFinalized: true,
        activeNotFinalized: false,
        finalizationKnown: true,
        finalizationSupported: true,
      },
      finalizedBy: '0x000000000000000000000000000000000000000a',
      finalizedBlock: '123',
      finalizedAt: '1000',
      finalizedTxHash: '0xtx',
    });
  });

  it('returns active-not-finalized metadata without blocking bootstrap admin mutations', async () => {
    const { service } = createFinalizationService(
      {
        orgId: '1',
        organizationStatus: OrganizationStatus.Active,
        storedFinalizationStatus:
          ORGANIZATION_FINALIZATION_STATUSES.NotFinalized,
      },
      'v0.7.0-alpha.2',
    );

    await expect(service.getOrganizationFinalization('1')).resolves.toEqual({
      orgId: '1',
      organizationStatus: OrganizationStatus.Active,
      lifecycleStatus: ORGANIZATION_LIFECYCLE_STATUSES.ActiveNotFinalized,
      finalizationStatus: ORGANIZATION_FINALIZATION_STATUSES.NotFinalized,
      finalized: false,
      bootstrapAdminMutationsAllowed: true,
      blockedBootstrapAdminOperations: [],
      derived: {
        activeAndFinalized: false,
        activeNotFinalized: true,
        finalizationKnown: true,
        finalizationSupported: true,
      },
    });
  });

  it('does not claim finalization read-model support for older contracts', async () => {
    const { service } = createFinalizationService(
      {
        orgId: '1',
        organizationStatus: OrganizationStatus.Active,
        storedFinalizationStatus:
          ORGANIZATION_FINALIZATION_STATUSES.NotFinalized,
      },
      'v0.7.0-alpha.1',
    );

    await expect(service.getOrganizationFinalization('1')).resolves.toEqual({
      orgId: '1',
      organizationStatus: OrganizationStatus.Active,
      lifecycleStatus: ORGANIZATION_LIFECYCLE_STATUSES.Unsupported,
      finalizationStatus: ORGANIZATION_FINALIZATION_STATUSES.Unsupported,
      finalized: null,
      bootstrapAdminMutationsAllowed: null,
      blockedBootstrapAdminOperations: [],
      derived: {
        activeAndFinalized: false,
        activeNotFinalized: false,
        finalizationKnown: false,
        finalizationSupported: false,
      },
    });
  });
});

function createRouteService(fixture: RouteFixture): {
  service: ReadModelsService;
  query: QueryMock;
} {
  const query: QueryMock = jest.fn((sql: string) => {
    const normalized = normalizeSql(sql);
    if (normalized.includes('from proposals')) {
      return Promise.resolve({
        rows:
          fixture.proposal === undefined ? [proposal()] : [fixture.proposal],
      });
    }
    if (normalized.includes('from policy_rules')) {
      return Promise.resolve({
        rows: Object.prototype.hasOwnProperty.call(fixture, 'policy')
          ? fixture.policy
            ? [fixture.policy]
            : []
          : [policy()],
      });
    }
    if (normalized.includes('from bodies')) {
      return Promise.resolve({
        rows: [...(fixture.bodies ?? [{ body_id: '1', name: 'Council' }])],
      });
    }
    if (normalized.includes('from proposal_decisions')) {
      return Promise.resolve({
        rows: [...(fixture.decisions ?? [approvalDecision('1')])],
      });
    }
    return Promise.resolve({ rows: [] });
  });
  const db = { query } as unknown as DatabaseService;
  const config = {
    evmContractsVersion: 'v0.7.0-alpha.3',
  } as unknown as AppConfigService;
  return { service: new ReadModelsService(db, config), query };
}

function createPolicyListService(rows: readonly Record<string, unknown>[]): {
  service: ReadModelsService;
  query: QueryMock;
} {
  const query: QueryMock = jest.fn((_sql: string, params?: unknown[]) =>
    Promise.resolve({
      rows: rows.filter((row) => row.orgId === params?.[0]),
    }),
  );
  const db = { query } as unknown as DatabaseService;
  const config = {
    evmContractsVersion: 'v0.7.0-alpha.3',
  } as unknown as AppConfigService;
  return { service: new ReadModelsService(db, config), query };
}

function createFinalizationService(
  row: Record<string, unknown> | undefined,
  evmContractsVersion: string | undefined,
): {
  service: ReadModelsService;
  query: QueryMock;
} {
  const query: QueryMock = jest.fn((sql: string, params?: unknown[]) => {
    void sql;
    void params;
    return Promise.resolve({
      rows: row ? [row] : [],
    });
  });
  const db = { query } as unknown as DatabaseService;
  const config = { evmContractsVersion } as unknown as AppConfigService;
  return { service: new ReadModelsService(db, config), query };
}

function currentPolicy(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    chainId: 31337,
    orgId: '1',
    proposalType: ProposalType.Standard,
    version: '1',
    required_approval_bodies: ['1'],
    veto_bodies: [],
    executor_body: '2',
    timelock_seconds: '0',
    enabled: true,
    data_status: DataStatus.Confirmed,
    ...overrides,
  };
}

function proposal(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    chain_id: '31337',
    org_id: '1',
    proposal_id: '42',
    proposal_type: ProposalType.Standard,
    policy_version: '7',
    status: ProposalStatus.Approved,
    queued_at_chain: null,
    executable_at_chain: null,
    ...overrides,
  };
}

function policy(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    required_approval_bodies: ['1'],
    veto_bodies: [],
    executor_body: '3',
    timelock_seconds: '0',
    enabled: true,
    ...overrides,
  };
}

function approvalDecision(bodyId: string): Record<string, unknown> {
  return decision(bodyId, DecisionType.Approve);
}

function vetoDecision(bodyId: string): Record<string, unknown> {
  return decision(bodyId, DecisionType.Veto);
}

function decision(
  bodyId: string,
  decisionType: DecisionType,
): Record<string, unknown> {
  return {
    body_id: bodyId,
    decision_type: decisionType,
    actor_address: '0x0000000000000000000000000000000000000001',
    tx_hash: `0x${decisionType}${bodyId}`,
    decided_at_chain: '100',
  };
}

function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').toLowerCase();
}
