import { Injectable } from '@nestjs/common';
import {
  type BodyDto,
  DecisionType,
  type GovernanceGraphDto,
  GraphEdgeType,
  GraphNodeType,
  type JsonObject,
  type MandateDto,
  type OrganizationDto,
  type OrganizationOverviewCountsDto,
  type OrganizationOverviewDto,
  type ProposalDto,
  type ProposalRouteExplanationDto,
  type ProposalSummaryDto,
  ProposalStatus,
  type ProposalType,
  type RoleDto,
  RouteBlockedReasonCode,
  type RouteBlockedReasonDto,
  type RouteBodyRequirementDto,
  type RouteBodyVetoDto,
} from '@isonia/types';
import { asStringArray } from '../chain/json';
import { DatabaseService } from '../database/database.service';

interface ProposalRouteRow {
  readonly chain_id: string;
  readonly org_id: string;
  readonly proposal_id: string;
  readonly proposal_type: ProposalType;
  readonly policy_version: string;
  readonly status: ProposalStatus;
  readonly queued_at_chain: string | null;
  readonly executable_at_chain: string | null;
}

interface PolicyRuleRow {
  readonly required_approval_bodies: unknown;
  readonly veto_bodies: unknown;
  readonly executor_body: string | null;
  readonly timelock_seconds: string;
  readonly enabled: boolean;
}

interface ProposalDecisionRow {
  readonly body_id: string;
  readonly decision_type: string;
  readonly actor_address: string;
  readonly tx_hash: string;
  readonly decided_at_chain: string;
}

@Injectable()
export class ReadModelsService {
  constructor(private readonly db: DatabaseService) {}

  async getOrganizations(): Promise<OrganizationDto[]> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", slug, name, metadata_uri as "metadataUri",
               admin_address as "adminAddress", status, created_block as "createdBlock",
               created_tx_hash as "createdTxHash", data_status as "dataStatus"
        from organizations
        order by org_id asc
      `,
    );
    return normalizeRows<OrganizationDto>(result.rows);
  }

  async getOrganization(orgId: string): Promise<OrganizationDto | undefined> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", slug, name, metadata_uri as "metadataUri",
               admin_address as "adminAddress", status, created_block as "createdBlock",
               created_tx_hash as "createdTxHash", data_status as "dataStatus"
        from organizations
        where org_id = $1
      `,
      [orgId],
    );
    return normalizeRows<OrganizationDto>(result.rows)[0];
  }

  async getOverview(orgId: string): Promise<OrganizationOverviewDto | undefined> {
    const organization = await this.getOrganization(orgId);
    if (!organization) {
      return undefined;
    }
    const counts = await this.db.query(
      `
        select
          (select count(*)::int from bodies where org_id = $1) as bodies,
          (select count(*)::int from roles where org_id = $1) as roles,
          (select count(*)::int from mandates where org_id = $1 and active = true and revoked = false) as "activeMandates",
          (select count(*)::int from proposals where org_id = $1 and status = any($2)) as "activeProposals"
      `,
      [orgId, [ProposalStatus.Created, ProposalStatus.UnderReview, ProposalStatus.Approved, ProposalStatus.Queued]],
    );
    const latestProposals = await this.getProposals(orgId, 5);
    return {
      organization,
      counts: normalizeRow<OrganizationOverviewCountsDto>(counts.rows[0] ?? {}),
      latestProposals,
    };
  }

  async getBodies(orgId: string): Promise<BodyDto[]> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", body_id as "bodyId", kind, name,
               metadata_uri as "metadataUri", active, created_block as "createdBlock",
               data_status as "dataStatus"
        from bodies
        where org_id = $1
        order by body_id asc
      `,
      [orgId],
    );
    return normalizeRows<BodyDto>(result.rows);
  }

  async getRoles(orgId: string): Promise<RoleDto[]> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", body_id as "bodyId", role_id as "roleId",
               role_type as "roleType", name, metadata_uri as "metadataUri", active,
               data_status as "dataStatus"
        from roles
        where org_id = $1
        order by role_id asc
      `,
      [orgId],
    );
    return normalizeRows<RoleDto>(result.rows);
  }

  async getMandates(orgId: string): Promise<MandateDto[]> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", mandate_id as "mandateId",
               body_id as "bodyId", role_id as "roleId", holder_address as "holderAddress",
               start_time as "startTime", end_time as "endTime",
               proposal_type_mask as "proposalTypeMask", spending_limit as "spendingLimit",
               active, revoked, data_status as "dataStatus"
        from mandates
        where org_id = $1
        order by mandate_id asc
      `,
      [orgId],
    );
    return normalizeRows<MandateDto>(result.rows);
  }

  async getHolderMandates(orgId: string, address: string): Promise<MandateDto[]> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", mandate_id as "mandateId",
               body_id as "bodyId", role_id as "roleId", holder_address as "holderAddress",
               start_time as "startTime", end_time as "endTime",
               proposal_type_mask as "proposalTypeMask", spending_limit as "spendingLimit",
               active, revoked, data_status as "dataStatus"
        from mandates
        where org_id = $1 and holder_address = lower($2)
        order by mandate_id asc
      `,
      [orgId, address],
    );
    return normalizeRows<MandateDto>(result.rows);
  }

  async getProposals(orgId: string, limit = 100): Promise<ProposalSummaryDto[]> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", proposal_id as "proposalId",
               proposal_type as "proposalType", policy_version as "policyVersion",
               title, creator_address as "creatorAddress", status,
               created_at_chain as "createdAtChain", data_status as "dataStatus"
        from proposals
        where org_id = $1
        order by proposal_id desc
        limit $2
      `,
      [orgId, limit],
    );
    return normalizeRows<ProposalSummaryDto>(result.rows);
  }

  async getProposal(orgId: string, proposalId: string): Promise<ProposalDto | undefined> {
    const result = await this.db.query(
      `
        select chain_id::int as "chainId", org_id as "orgId", proposal_id as "proposalId",
               proposal_type as "proposalType", policy_version as "policyVersion", title,
               description_uri as "descriptionUri", target_address as "targetAddress",
               value, data_hash as "dataHash", creator_address as "creatorAddress",
               status, created_block as "createdBlock", created_tx_hash as "createdTxHash",
               created_at_chain as "createdAtChain", queued_at_chain as "queuedAtChain",
               executable_at_chain as "executableAtChain", executed_at_chain as "executedAtChain",
               data_status as "dataStatus"
        from proposals
        where org_id = $1 and proposal_id = $2
      `,
      [orgId, proposalId],
    );
    return normalizeRows<ProposalDto>(result.rows)[0];
  }

  async getProposalRoute(orgId: string, proposalId: string): Promise<ProposalRouteExplanationDto | undefined> {
    const proposalResult = await this.db.query(
      `select * from proposals where org_id = $1 and proposal_id = $2`,
      [orgId, proposalId],
    );
    const proposal = proposalResult.rows[0] as ProposalRouteRow | undefined;
    if (!proposal) {
      return undefined;
    }

    const policyResult = await this.db.query(
      `
        select *
        from policy_rules
        where chain_id = $1 and org_id = $2 and proposal_type = $3 and version = $4
      `,
      [proposal.chain_id, orgId, proposal.proposal_type, proposal.policy_version],
    );
    const policy = policyResult.rows[0] as PolicyRuleRow | undefined;
    const requiredBodies = policy ? asStringArray(policy.required_approval_bodies) : [];
    const vetoBodies = policy ? asStringArray(policy.veto_bodies) : [];
    const bodyNames = await this.getBodyNameMap(orgId);
    const decisions = await this.getDecisionMap(proposal.chain_id, proposalId);

    const requiredApprovalBodies: RouteBodyRequirementDto[] = requiredBodies.map((bodyId) => {
      const decision = decisions.get(`${bodyId}:${DecisionType.Approve}`);
      return normalizeRow<RouteBodyRequirementDto>({
        bodyId,
        bodyName: bodyNames.get(bodyId) ?? `Body #${bodyId}`,
        required: true,
        approved: Boolean(decision),
        approvedBy: decision?.actor_address,
        approvedAtChain: decision?.decided_at_chain,
        txHash: decision?.tx_hash,
      });
    });

    const routeVetoBodies: RouteBodyVetoDto[] = vetoBodies.map((bodyId) => {
      const decision = decisions.get(`${bodyId}:${DecisionType.Veto}`);
      return normalizeRow<RouteBodyVetoDto>({
        bodyId,
        bodyName: bodyNames.get(bodyId) ?? `Body #${bodyId}`,
        canVeto: true,
        vetoed: Boolean(decision),
        vetoedBy: decision?.actor_address,
        vetoedAtChain: decision?.decided_at_chain,
        txHash: decision?.tx_hash,
      });
    });

    const nowSeconds = Math.floor(Date.now() / 1_000);
    const timelockSeconds = Number(policy?.timelock_seconds ?? 0);
    const executableAt = proposal.executable_at_chain ? Number(proposal.executable_at_chain) : undefined;
    const missingApproval = requiredApprovalBodies.find((body) => !body.approved);
    const vetoed = routeVetoBodies.find((body) => body.vetoed);
    const blockedReasons: RouteBlockedReasonDto[] = [];
    if (!policy) {
      blockedReasons.push(reason(RouteBlockedReasonCode.PolicySnapshotMissing, 'Proposal policy snapshot is missing from projections.'));
    } else if (!policy.enabled) {
      blockedReasons.push(reason(RouteBlockedReasonCode.PolicyDisabled, 'Policy rule is disabled.'));
    }
    if (missingApproval) {
      blockedReasons.push(
        reason(RouteBlockedReasonCode.MissingApproval, `Missing approval from ${missingApproval.bodyName}.`, missingApproval.bodyId),
      );
    }
    if (vetoed) {
      blockedReasons.push(reason(RouteBlockedReasonCode.Vetoed, `Proposal was vetoed by ${vetoed.bodyName}.`, vetoed.bodyId));
    }
    if (proposal.status === ProposalStatus.Approved && timelockSeconds > 0) {
      blockedReasons.push(reason(RouteBlockedReasonCode.NotQueued, 'Proposal must be queued before execution.'));
    }
    if (proposal.status === ProposalStatus.Queued && executableAt !== undefined && nowSeconds < executableAt) {
      blockedReasons.push(reason(RouteBlockedReasonCode.TimelockNotSatisfied, 'Timelock has not elapsed.'));
    }
    if (proposal.status === ProposalStatus.Executed) {
      blockedReasons.push(reason(RouteBlockedReasonCode.AlreadyExecuted, 'Proposal is already executed.'));
    }
    if (proposal.status === ProposalStatus.Cancelled) {
      blockedReasons.push(reason(RouteBlockedReasonCode.Cancelled, 'Proposal is cancelled.'));
    }
    if (proposal.status === ProposalStatus.Expired) {
      blockedReasons.push(reason(RouteBlockedReasonCode.Expired, 'Proposal is expired.'));
    }

    return normalizeRow<ProposalRouteExplanationDto>({
      chainId: Number(proposal.chain_id),
      orgId: proposal.org_id,
      proposalId: proposal.proposal_id,
      proposalType: proposal.proposal_type,
      policyVersion: proposal.policy_version,
      status: proposal.status,
      requiredApprovalBodies,
      vetoBodies: routeVetoBodies,
      timelock: {
        required: timelockSeconds > 0,
        seconds: String(timelockSeconds),
        queuedAtChain: proposal.queued_at_chain,
        executableAtChain: proposal.executable_at_chain,
        satisfied: timelockSeconds === 0 || (executableAt !== undefined && nowSeconds >= executableAt),
      },
      execution: {
        executable:
          blockedReasons.length === 0 && (proposal.status === ProposalStatus.Approved || proposal.status === ProposalStatus.Queued),
        executorBody: policy?.executor_body === null ? undefined : policy?.executor_body,
        blockedReasons,
      },
    });
  }

  async getGraph(orgId: string): Promise<GovernanceGraphDto | undefined> {
    const [organizations, bodies, roles, holders, proposals, edges] = await Promise.all([
      this.db.query(`select chain_id::int as "chainId", org_id, name from organizations where org_id = $1`, [orgId]),
      this.db.query(`select body_id, name, kind from bodies where org_id = $1`, [orgId]),
      this.db.query(`select role_id, name, role_type from roles where org_id = $1`, [orgId]),
      this.db.query(`select distinct holder_address from mandates where org_id = $1`, [orgId]),
      this.db.query(`select proposal_id, title, status from proposals where org_id = $1`, [orgId]),
      this.db.query(
        `
          select source_type as "sourceType", source_id as "sourceId", target_type as "targetType",
                 target_id as "targetId", edge_type as "type", label, metadata
          from governance_edges
          where org_id = $1
          order by id asc
        `,
        [orgId],
      ),
    ]);
    const org = organizations.rows[0];
    if (!org) {
      return undefined;
    }

    return normalizeRow<GovernanceGraphDto>({
      chainId: org.chainId,
      orgId,
      nodes: [
        { id: `organization:${org.org_id}`, type: GraphNodeType.Organization, label: org.name },
        ...bodies.rows.map((row) => ({ id: `body:${row.body_id}`, type: GraphNodeType.Body, label: row.name, metadata: { kind: row.kind } })),
        ...roles.rows.map((row) => ({
          id: `role:${row.role_id}`,
          type: GraphNodeType.Role,
          label: row.name,
          metadata: { roleType: row.role_type },
        })),
        ...holders.rows.map((row) => ({ id: `holder:${row.holder_address}`, type: GraphNodeType.Holder, label: row.holder_address })),
        ...proposals.rows.map((row) => ({
          id: `proposal:${row.proposal_id}`,
          type: GraphNodeType.Proposal,
          label: row.title,
          metadata: { status: row.status },
        })),
      ],
      edges: edges.rows.map((edge, index) => ({
        id: `edge:${index + 1}`,
        sourceId: `${edge.sourceType}:${edge.sourceId}`,
        targetId: `${edge.targetType}:${edge.targetId}`,
        type: edge.type as GraphEdgeType,
        label: edge.label,
        metadata: edge.metadata as JsonObject,
      })),
    });
  }

  private async getBodyNameMap(orgId: string): Promise<Map<string, string>> {
    const result = await this.db.query(`select body_id, name from bodies where org_id = $1`, [orgId]);
    return new Map(result.rows.map((row) => [String(row.body_id), String(row.name)]));
  }

  private async getDecisionMap(chainId: string, proposalId: string): Promise<Map<string, ProposalDecisionRow>> {
    const result = await this.db.query(
      `select body_id, decision_type, actor_address, tx_hash, decided_at_chain from proposal_decisions where chain_id = $1 and proposal_id = $2`,
      [chainId, proposalId],
    );
    return new Map(result.rows.map((row) => [`${row.body_id}:${row.decision_type}`, row as ProposalDecisionRow]));
  }
}

function reason(code: RouteBlockedReasonCode, message: string, relatedBodyId?: string): RouteBlockedReasonDto {
  return relatedBodyId ? { code, message, relatedBodyId } : { code, message };
}

function normalizeRows<T>(rows: readonly Record<string, unknown>[]): T[] {
  return rows.map((row) => normalizeRow<T>(row));
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, normalizeValue(value)]),
  ) as T;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (value && typeof value === 'object') {
    return normalizeRow(value as Record<string, unknown>);
  }
  return value;
}
