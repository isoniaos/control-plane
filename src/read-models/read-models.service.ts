import { Injectable } from '@nestjs/common';
import {
  AccountabilityExecutionStatus,
  type AccountabilityRecordDto,
  type Address,
  ArchiveProposalDisplayState,
  type ArchiveProposalSummaryDto,
  type BodyDto,
  DataStatus,
  type DecisionRecordDto,
  DecisionRecordResult,
  type ExecutionSelectorRuleDto,
  type ExecutionTargetPermissionDto,
  type ExecutionTargetRuleDto,
  type ExternalResourceDto,
  type ExternalResourceRefDto,
  ExternalAuthorityClaim,
  ExternalSourceLabel,
  ExternalTrustBoundary,
  DecisionType,
  ExternalResourceProvider,
  ExternalResourceRelation,
  type GovernanceGraphDto,
  GovernanceRecordSourceCategory,
  GraphEdgeType,
  GraphNodeType,
  type JsonObject,
  type MandateDto,
  type NumericString,
  type OrganizationDto,
  type OrganizationExecutionPermissionsDto,
  type OrganizationFinalizationReadModelDto,
  type OrganizationManagedExecutionDto,
  type OrganizationOverviewCountsDto,
  type OrganizationOverviewDto,
  type OrganizationPoliciesDto,
  type OrganizationPolicyDto,
  ObservedTransactionStatus,
  type OrgExecutorDto,
  type ProposalExecutionReceiptDto,
  ProposalExecutionMode,
  type ProposalDto,
  type ProposalRouteExplanationDto,
  type ProposalSummaryDto,
  ProposalStatus,
  type ProposalType,
  type PublicOrganizationArchiveCountsDto,
  type PublicOrganizationArchiveDto,
  type RoleDto,
  RouteBlockedReasonCode,
  type RouteBlockedReasonDto,
  type RouteBodyRequirementDto,
  type RouteBodyVetoDto,
  type SourceDisclosureDto,
  type TransactionHash,
  ORGANIZATION_FINALIZATION_STATUSES,
  ORGANIZATION_LIFECYCLE_STATUSES,
  OrganizationStatus,
  POST_FINALIZATION_BLOCKED_BOOTSTRAP_ADMIN_OPERATIONS,
} from '@isonia/types';
import { asStringArray } from '../chain/json';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import {
  DEPLOYMENT_CAPABILITY_STATUSES,
  resolveExecutionPermissionRegistryCapability,
  resolveOrganizationFinalizationCapability,
  toOrganizationFinalizationCapabilityStatus,
} from '../system/deployment-capabilities';

interface ProposalRouteRow {
  readonly chain_id: string;
  readonly org_id: string;
  readonly proposal_id: string;
  readonly proposal_type: ProposalType;
  readonly policy_version: string;
  readonly status: ProposalStatus;
  readonly target_address: Address | null;
  readonly value: string;
  readonly action_selector: string | null;
  readonly data_hash: string | null;
  readonly queued_at_chain: string | null;
  readonly executable_at_chain: string | null;
}

interface ArchiveProposalRow {
  readonly chainId: number;
  readonly orgId: string;
  readonly proposalId: string;
  readonly proposalType: ProposalType;
  readonly policyVersion: string;
  readonly title: string;
  readonly status: ProposalStatus;
  readonly createdAtChain: string;
  readonly queuedAtChain: string | null;
  readonly executedAtChain: string | null;
  readonly updatedAt: Date | string | null;
  readonly accountabilityId: string | null;
  readonly executionStatus: string | null;
  readonly responsiblePartyLabel: string | null;
  readonly dueDate: string | null;
  readonly linkedTxHash: string | null;
  readonly manualUpdateCount: number;
  readonly externalSourceCount: number;
}

interface AccountabilityRecordRow {
  readonly chainId: number;
  readonly orgId: string;
  readonly proposalId: string;
  readonly id: string;
  readonly decisionRecordId: string | null;
  readonly responsiblePartyLabel: string | null;
  readonly responsiblePartyWallet: Address | null;
  readonly responsiblePartyExternalIdentityUrl: string | null;
  readonly dueDate: string | null;
  readonly executionStatus: AccountabilityExecutionStatus;
  readonly linkedTxHash: TransactionHash | null;
  readonly linkedChainId: number | null;
  readonly linkedExplorerUrl: string | null;
  readonly linkedTxObservedStatus: ObservedTransactionStatus | null;
  readonly failureOrCancellationReason: string | null;
  readonly manualUpdates: unknown;
  readonly completionConfirmation: unknown;
  readonly sourceDisclosure: SourceDisclosureDto | null;
}

interface ExternalResourceRow {
  readonly id: string;
  readonly orgId: string;
  readonly proposalId: string | null;
  readonly decisionRecordId: string | null;
  readonly accountabilityRecordId: string | null;
  readonly provider: ExternalResourceProvider;
  readonly relation: ExternalResourceRelation;
  readonly url: string;
  readonly canonicalRef: string | null;
  readonly title: string | null;
  readonly sourceLabel: ExternalSourceLabel;
  readonly trustBoundary: ExternalTrustBoundary;
  readonly authorityClaim: ExternalAuthorityClaim;
  readonly importStatus: string | null;
  readonly observedAt: Date | string | null;
  readonly importedAt: Date | string | null;
  readonly importedBy: string | null;
  readonly verificationMethod: string | null;
  readonly sourceDisclosure: SourceDisclosureDto | null;
  readonly rawMetadataPreview: JsonObject | null;
}

interface DecisionProposalRow {
  readonly chain_id: string;
  readonly org_id: string;
  readonly proposal_id: string;
  readonly proposal_type: ProposalType;
  readonly policy_version: string;
  readonly title: string;
  readonly target_address: Address | null;
  readonly value: string;
  readonly status: ProposalStatus;
  readonly created_at_chain: string;
  readonly queued_at_chain: string | null;
  readonly executed_at_chain: string | null;
  readonly updated_at: Date | string | null;
}

interface PolicyRuleRow {
  readonly required_approval_bodies: unknown;
  readonly veto_bodies: unknown;
  readonly executor_body: string | null;
  readonly timelock_seconds: string;
  readonly enabled: boolean;
}

interface CurrentPolicyRuleRow {
  readonly chainId: number;
  readonly orgId: string;
  readonly proposalType: ProposalType;
  readonly version: string;
  readonly required_approval_bodies: unknown;
  readonly veto_bodies: unknown;
  readonly executor_body: string | null;
  readonly timelock_seconds: string;
  readonly enabled: boolean;
  readonly data_status: string;
}

interface ProposalDecisionRow {
  readonly body_id: string;
  readonly decision_type: DecisionType;
  readonly actor_address: string;
  readonly tx_hash: string;
  readonly decided_at_chain: string;
}

interface GraphOrganizationRow {
  readonly chainId: number;
  readonly org_id: string;
  readonly name: string;
}

interface GraphBodyRow {
  readonly body_id: string;
  readonly name: string;
  readonly kind: string;
}

interface GraphRoleRow {
  readonly role_id: string;
  readonly name: string;
  readonly role_type: string;
}

interface GraphHolderRow {
  readonly holder_address: string;
}

interface GraphProposalRow {
  readonly proposal_id: string;
  readonly title: string;
  readonly status: ProposalStatus;
}

interface GraphEdgeRow {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly type: GraphEdgeType;
  readonly label: string | null;
  readonly metadata: JsonObject | null;
}

interface BodyNameRow {
  readonly body_id: string;
  readonly name: string;
}

interface OrganizationFinalizationRow {
  readonly orgId: string;
  readonly organizationStatus: OrganizationStatus;
  readonly storedFinalizationStatus: string;
  readonly finalizedBy: Address | null;
  readonly finalizedBlock: NumericString | null;
  readonly finalizedTxHash: TransactionHash | null;
  readonly finalizedAt: string | null;
}

interface ExecutionTargetRuleRow {
  readonly orgId: string;
  readonly targetAddress: Address;
  readonly enabled: boolean;
  readonly maxValue: string;
  readonly updatedAtBlockNumber: NumericString | null;
  readonly updatedAtTxHash: TransactionHash | null;
  readonly updatedByAddress: Address | null;
}

interface ExecutionSelectorRuleRow {
  readonly orgId: string;
  readonly targetAddress: Address;
  readonly selector: string;
  readonly enabled: boolean;
  readonly updatedAtBlockNumber: NumericString | null;
  readonly updatedAtTxHash: TransactionHash | null;
  readonly updatedByAddress: Address | null;
}

interface ExecutionRouteTargetRuleRow {
  readonly enabled: boolean;
  readonly max_value: string;
  readonly selector_rule_count: number | string;
  readonly selector_enabled: boolean | null;
}

interface OrgExecutorRow {
  readonly orgId: string;
  readonly executorAddress: Address | null;
  readonly previousExecutorAddress: Address | null;
  readonly updatedByAddress: Address | null;
  readonly transactionHash: TransactionHash | null;
  readonly blockNumber: NumericString | null;
  readonly updatedAt: Date | string | null;
}

interface ProposalReadRow {
  readonly chainId: number;
  readonly orgId: string;
  readonly proposalId: string;
  readonly proposalType: ProposalType;
  readonly policyVersion: string;
  readonly title: string;
  readonly descriptionUri: string | null;
  readonly targetAddress: Address | null;
  readonly value: string;
  readonly actionSelector: string | null;
  readonly dataHash: string | null;
  readonly creatorAddress: Address;
  readonly status: ProposalStatus;
  readonly createdBlock: NumericString;
  readonly createdTxHash: TransactionHash;
  readonly createdAtChain: NumericString;
  readonly queuedAtChain: NumericString | null;
  readonly executableAtChain: NumericString | null;
  readonly executedAtChain: NumericString | null;
  readonly dataStatus: DataStatus | null;
  readonly receiptExecutorAddress: Address | null;
  readonly receiptTargetAddress: Address | null;
  readonly receiptValue: string | null;
  readonly receiptActionSelector: string | null;
  readonly receiptDataHash: string | null;
  readonly receiptExecutionMode: ProposalExecutionMode | null;
  readonly receiptManagedExecutorAddress: Address | null;
  readonly receiptTransactionHash: TransactionHash | null;
  readonly receiptBlockNumber: NumericString | null;
  readonly receiptObservedAt: Date | string | null;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

@Injectable()
export class ReadModelsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: AppConfigService,
  ) {}

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

  async getOrganizationFinalization(
    orgId: string,
  ): Promise<OrganizationFinalizationReadModelDto | undefined> {
    const result = await this.db.query<OrganizationFinalizationRow>(
      `
        select org_id as "orgId", status as "organizationStatus",
               finalization_status as "storedFinalizationStatus",
               finalized_admin_address as "finalizedBy",
               finalized_block as "finalizedBlock",
               finalized_tx_hash as "finalizedTxHash",
               finalized_at_chain as "finalizedAt"
        from organizations
        where org_id = $1
      `,
      [orgId],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    const organizationStatus = String(
      row.organizationStatus,
    ) as OrganizationStatus;
    const finalizationStatus = this.resolveFinalizationStatus(
      String(row.storedFinalizationStatus),
    );
    const finalized =
      finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.Finalized
        ? true
        : finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.NotFinalized
          ? false
          : null;
    const finalizationSupported =
      finalizationStatus !== ORGANIZATION_FINALIZATION_STATUSES.Unsupported &&
      finalizationStatus !== ORGANIZATION_FINALIZATION_STATUSES.Unknown;
    const bootstrapAdminMutationsAllowed =
      finalized === null ? null : !finalized;

    return {
      orgId: row.orgId,
      organizationStatus,
      lifecycleStatus: lifecycleStatus(organizationStatus, finalizationStatus),
      finalizationStatus,
      finalized,
      bootstrapAdminMutationsAllowed,
      blockedBootstrapAdminOperations: finalized
        ? POST_FINALIZATION_BLOCKED_BOOTSTRAP_ADMIN_OPERATIONS
        : [],
      derived: {
        activeAndFinalized:
          organizationStatus === OrganizationStatus.Active &&
          finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.Finalized,
        activeNotFinalized:
          organizationStatus === OrganizationStatus.Active &&
          finalizationStatus ===
            ORGANIZATION_FINALIZATION_STATUSES.NotFinalized,
        finalizationKnown: finalized !== null,
        finalizationSupported,
      },
      ...(row.finalizedBy ? { finalizedBy: row.finalizedBy } : {}),
      ...(row.finalizedBlock ? { finalizedBlock: row.finalizedBlock } : {}),
      ...(row.finalizedAt ? { finalizedAt: row.finalizedAt } : {}),
      ...(row.finalizedTxHash ? { finalizedTxHash: row.finalizedTxHash } : {}),
    };
  }

  async getOverview(
    orgId: string,
  ): Promise<OrganizationOverviewDto | undefined> {
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
      [
        orgId,
        [
          ProposalStatus.Created,
          ProposalStatus.UnderReview,
          ProposalStatus.Approved,
          ProposalStatus.Queued,
        ],
      ],
    );
    const latestProposals = await this.getProposals(orgId, 5);
    return {
      organization,
      counts: normalizeRow<OrganizationOverviewCountsDto>(counts.rows[0] ?? {}),
      latestProposals,
    };
  }

  async getPublicArchive(
    orgId: string,
  ): Promise<PublicOrganizationArchiveDto | undefined> {
    const organization = await this.getOrganization(orgId);
    if (!organization) {
      return undefined;
    }

    const rows = await this.getArchiveProposalRows(orgId);
    const proposals = rows.map((row) => this.toArchiveProposalSummary(row));
    const counts = this.toArchiveCounts(rows);

    return {
      organization,
      counts,
      proposals,
      readModelStatus: derivedSourceDisclosure(
        'Archive summaries are derived from Control Plane read models. Control Plane does not invent governance authority.',
      ),
    };
  }

  async getDecisionRecords(orgId: string): Promise<DecisionRecordDto[]> {
    const result = await this.db.query<DecisionProposalRow>(
      `
        select chain_id, org_id, proposal_id, proposal_type, policy_version, title,
               target_address, value, status, created_at_chain, queued_at_chain,
               executed_at_chain, updated_at
        from proposals
        where chain_id = $1 and org_id = $2
        order by proposal_id desc
      `,
      [this.config.chainId, orgId],
    );

    return Promise.all(
      result.rows.map((proposal) => this.toDecisionRecord(proposal)),
    );
  }

  async getDecisionRecord(
    orgId: string,
    proposalId: string,
  ): Promise<DecisionRecordDto | undefined> {
    const proposal = await this.getDecisionProposal(orgId, proposalId);
    if (!proposal) {
      return undefined;
    }
    return this.toDecisionRecord(proposal);
  }

  async getAccountabilityRecord(
    orgId: string,
    proposalId: string,
  ): Promise<AccountabilityRecordDto | undefined> {
    const proposal = await this.getDecisionProposal(orgId, proposalId);
    if (!proposal) {
      return undefined;
    }
    const record = await this.getStoredAccountabilityRecord(orgId, proposalId);
    if (record) {
      return record;
    }

    return this.deriveAccountabilityRecord(proposal);
  }

  async getExternalResources(
    orgId: string,
    proposalId: string,
  ): Promise<ExternalResourceDto[] | undefined> {
    const proposal = await this.getDecisionProposal(orgId, proposalId);
    if (!proposal) {
      return undefined;
    }
    return this.getExternalResourcesForProposal(orgId, proposalId);
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

  async getHolderMandates(
    orgId: string,
    address: string,
  ): Promise<MandateDto[]> {
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

  async getPolicies(orgId: string): Promise<OrganizationPoliciesDto> {
    const result = await this.db.query<CurrentPolicyRuleRow>(
      `
        select chain_id::int as "chainId", org_id as "orgId", proposal_type as "proposalType",
               version, required_approval_bodies, veto_bodies, executor_body,
               timelock_seconds, enabled, data_status
        from current_policy_rules
        where org_id = $1
        order by proposal_type asc
      `,
      [orgId],
    );
    return result.rows.map((row) =>
      normalizeRow<OrganizationPolicyDto>({
        chainId: row.chainId,
        orgId: row.orgId,
        proposalType: row.proposalType,
        version: row.version,
        requiredApprovalBodies: asStringArray(row.required_approval_bodies),
        vetoBodies: asStringArray(row.veto_bodies),
        executorBody: row.executor_body,
        timelockSeconds: row.timelock_seconds,
        enabled: row.enabled,
        dataStatus: row.data_status,
      }),
    );
  }

  async getExecutionPermissions(
    orgId: string,
  ): Promise<OrganizationExecutionPermissionsDto> {
    const [targetResult, selectorResult] = await Promise.all([
      this.db.query<ExecutionTargetRuleRow>(
        `
          select org_id as "orgId",
                 target_address as "targetAddress",
                 enabled,
                 max_value as "maxValue",
                 updated_at_block_number as "updatedAtBlockNumber",
                 updated_at_tx_hash as "updatedAtTxHash",
                 updated_by_address as "updatedByAddress"
          from execution_target_rules
          where chain_id = $1 and org_id = $2
          order by target_address asc
        `,
        [this.config.chainId, orgId],
      ),
      this.db.query<ExecutionSelectorRuleRow>(
        `
          select org_id as "orgId",
                 target_address as "targetAddress",
                 selector,
                 enabled,
                 updated_at_block_number as "updatedAtBlockNumber",
                 updated_at_tx_hash as "updatedAtTxHash",
                 updated_by_address as "updatedByAddress"
          from execution_selector_rules
          where chain_id = $1 and org_id = $2
          order by target_address asc, selector asc
        `,
        [this.config.chainId, orgId],
      ),
    ]);

    const selectorsByTarget = new Map<string, ExecutionSelectorRuleDto[]>();
    for (const selector of selectorResult.rows) {
      const targetAddress = selector.targetAddress.toLowerCase();
      const selectors = selectorsByTarget.get(targetAddress) ?? [];
      selectors.push(toExecutionSelectorRule(selector));
      selectorsByTarget.set(targetAddress, selectors);
    }

    const targets: ExecutionTargetPermissionDto[] = targetResult.rows.map(
      (target) => ({
        ...toExecutionTargetRule(target),
        selectors:
          selectorsByTarget.get(target.targetAddress.toLowerCase()) ?? [],
      }),
    );

    return {
      orgId,
      targets,
    };
  }

  async getManagedExecution(
    orgId: string,
  ): Promise<OrganizationManagedExecutionDto> {
    const result = await this.db.query<OrgExecutorRow>(
      `
        select org_id as "orgId",
               executor_address as "executorAddress",
               previous_executor_address as "previousExecutorAddress",
               updated_by_address as "updatedByAddress",
               updated_tx_hash as "transactionHash",
               updated_block_number as "blockNumber",
               updated_at as "updatedAt"
        from org_executors
        where chain_id = $1 and org_id = $2
        limit 1
      `,
      [this.config.chainId, orgId],
    );
    const executor = result.rows[0]
      ? toOrgExecutorDto(result.rows[0])
      : undefined;

    return normalizeRow<OrganizationManagedExecutionDto>({
      orgId,
      executor,
    });
  }

  async getProposals(
    orgId: string,
    limit = 100,
  ): Promise<ProposalSummaryDto[]> {
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

  async getProposal(
    orgId: string,
    proposalId: string,
  ): Promise<ProposalDto | undefined> {
    const result = await this.db.query<ProposalReadRow>(
      `
        select p.chain_id::int as "chainId",
               p.org_id as "orgId",
               p.proposal_id as "proposalId",
               p.proposal_type as "proposalType",
               p.policy_version as "policyVersion",
               p.title,
               p.description_uri as "descriptionUri",
               p.target_address as "targetAddress",
               p.value,
               p.action_selector as "actionSelector",
               p.data_hash as "dataHash",
               p.creator_address as "creatorAddress",
               p.status,
               p.created_block as "createdBlock",
               p.created_tx_hash as "createdTxHash",
               p.created_at_chain as "createdAtChain",
               p.queued_at_chain as "queuedAtChain",
               p.executable_at_chain as "executableAtChain",
               p.executed_at_chain as "executedAtChain",
               p.data_status as "dataStatus",
               r.executor_address as "receiptExecutorAddress",
               r.target_address as "receiptTargetAddress",
               r.value as "receiptValue",
               r.action_selector as "receiptActionSelector",
               r.data_hash as "receiptDataHash",
               r.execution_mode as "receiptExecutionMode",
               r.managed_executor_address as "receiptManagedExecutorAddress",
               r.tx_hash as "receiptTransactionHash",
               r.block_number as "receiptBlockNumber",
               r.observed_at as "receiptObservedAt"
        from proposals p
        left join proposal_execution_receipts r
          on r.chain_id = p.chain_id
         and r.org_id = p.org_id
         and r.proposal_id = p.proposal_id
        where p.chain_id = $1 and p.org_id = $2 and p.proposal_id = $3
      `,
      [this.config.chainId, orgId, proposalId],
    );
    const row = result.rows[0];
    return row ? toProposalDto(row) : undefined;
  }

  async getProposalRoute(
    orgId: string,
    proposalId: string,
  ): Promise<ProposalRouteExplanationDto | undefined> {
    const proposalResult = await this.db.query<ProposalRouteRow>(
      `select * from proposals where chain_id = $1 and org_id = $2 and proposal_id = $3`,
      [this.config.chainId, orgId, proposalId],
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) {
      return undefined;
    }

    const policyResult = await this.db.query<PolicyRuleRow>(
      `
        select *
        from policy_rules
        where chain_id = $1 and org_id = $2 and proposal_type = $3 and version = $4
      `,
      [
        proposal.chain_id,
        orgId,
        proposal.proposal_type,
        proposal.policy_version,
      ],
    );
    const policy = policyResult.rows[0];
    const requiredBodies = policy
      ? asStringArray(policy.required_approval_bodies)
      : [];
    const vetoBodies = policy ? asStringArray(policy.veto_bodies) : [];
    const bodyNames = await this.getBodyNameMap(orgId);
    const decisions = await this.getDecisionMap(
      proposal.chain_id,
      orgId,
      proposalId,
    );
    const executionTargetRule =
      await this.getExecutionTargetRuleForRoute(proposal);

    const requiredApprovalBodies: RouteBodyRequirementDto[] =
      requiredBodies.map((bodyId) => {
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
    const executableAt = proposal.executable_at_chain
      ? Number(proposal.executable_at_chain)
      : undefined;
    const missingApproval = requiredApprovalBodies.find(
      (body) => !body.approved,
    );
    const vetoed = routeVetoBodies.find((body) => body.vetoed);
    const blockedReasons: RouteBlockedReasonDto[] = [];
    if (!policy) {
      blockedReasons.push(
        reason(
          RouteBlockedReasonCode.PolicySnapshotMissing,
          'Proposal policy snapshot is missing from projections.',
        ),
      );
    } else if (!policy.enabled) {
      blockedReasons.push(
        reason(
          RouteBlockedReasonCode.PolicyDisabled,
          'Policy rule is disabled.',
        ),
      );
    }
    if (missingApproval) {
      blockedReasons.push(
        reason(
          RouteBlockedReasonCode.MissingApproval,
          `Missing approval from ${missingApproval.bodyName}.`,
          missingApproval.bodyId,
        ),
      );
    }
    if (vetoed) {
      blockedReasons.push(
        reason(
          RouteBlockedReasonCode.Vetoed,
          `Proposal was vetoed by ${vetoed.bodyName}.`,
          vetoed.bodyId,
        ),
      );
    }
    if (proposal.status === ProposalStatus.Approved && timelockSeconds > 0) {
      blockedReasons.push(
        reason(
          RouteBlockedReasonCode.NotQueued,
          'Proposal must be queued before execution.',
        ),
      );
    }
    if (
      proposal.status === ProposalStatus.Queued &&
      executableAt !== undefined &&
      nowSeconds < executableAt
    ) {
      blockedReasons.push(
        reason(
          RouteBlockedReasonCode.TimelockNotSatisfied,
          'Timelock has not elapsed.',
        ),
      );
    }
    if (proposal.status === ProposalStatus.Executed) {
      blockedReasons.push(
        reason(
          RouteBlockedReasonCode.AlreadyExecuted,
          'Proposal is already executed.',
        ),
      );
    }
    if (proposal.status === ProposalStatus.Cancelled) {
      blockedReasons.push(
        reason(RouteBlockedReasonCode.Cancelled, 'Proposal is cancelled.'),
      );
    }
    if (proposal.status === ProposalStatus.Expired) {
      blockedReasons.push(
        reason(RouteBlockedReasonCode.Expired, 'Proposal is expired.'),
      );
    }
    if (
      this.executionPermissionRegistrySupported() &&
      proposal.target_address
    ) {
      if (!executionTargetRule || !executionTargetRule.enabled) {
        blockedReasons.push(
          reason(
            RouteBlockedReasonCode.ExecutionTargetNotAllowed,
            'Proposal execution target is not allowed by the onchain execution permission registry.',
          ),
        );
      } else {
        if (
          isValueExceedingLimit(proposal.value, executionTargetRule.max_value)
        ) {
          blockedReasons.push(
            reason(
              RouteBlockedReasonCode.ExecutionValueLimitExceeded,
              'Proposal execution value exceeds the target rule max value.',
            ),
          );
        }
        if (Number(executionTargetRule.selector_rule_count) > 0) {
          if (!proposal.action_selector) {
            blockedReasons.push(
              reason(
                RouteBlockedReasonCode.ExecutionCalldataUnavailable,
                'Selector-level execution permission cannot be verified because the proposal action selector is unavailable in the read model.',
              ),
            );
          } else if (executionTargetRule.selector_enabled !== true) {
            blockedReasons.push(
              reason(
                RouteBlockedReasonCode.ExecutionSelectorNotAllowed,
                'Proposal execution selector is not allowed by the onchain execution permission registry.',
              ),
            );
          }
        }
      }
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
        satisfied:
          timelockSeconds === 0 ||
          (executableAt !== undefined && nowSeconds >= executableAt),
      },
      execution: {
        executable:
          blockedReasons.length === 0 &&
          (proposal.status === ProposalStatus.Approved ||
            proposal.status === ProposalStatus.Queued),
        executorBody:
          policy?.executor_body === null ? undefined : policy?.executor_body,
        blockedReasons,
      },
    });
  }

  async getGraph(orgId: string): Promise<GovernanceGraphDto | undefined> {
    const [organizations, bodies, roles, holders, proposals, edges] =
      await Promise.all([
        this.db.query<GraphOrganizationRow>(
          `select chain_id::int as "chainId", org_id, name from organizations where org_id = $1`,
          [orgId],
        ),
        this.db.query<GraphBodyRow>(
          `select body_id, name, kind from bodies where org_id = $1`,
          [orgId],
        ),
        this.db.query<GraphRoleRow>(
          `select role_id, name, role_type from roles where org_id = $1`,
          [orgId],
        ),
        this.db.query<GraphHolderRow>(
          `select distinct holder_address from mandates where org_id = $1`,
          [orgId],
        ),
        this.db.query<GraphProposalRow>(
          `select proposal_id, title, status from proposals where org_id = $1`,
          [orgId],
        ),
        this.db.query<GraphEdgeRow>(
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
        {
          id: `organization:${org.org_id}`,
          type: GraphNodeType.Organization,
          label: org.name,
        },
        ...bodies.rows.map((row) => ({
          id: `body:${row.body_id}`,
          type: GraphNodeType.Body,
          label: row.name,
          metadata: { kind: row.kind },
        })),
        ...roles.rows.map((row) => ({
          id: `role:${row.role_id}`,
          type: GraphNodeType.Role,
          label: row.name,
          metadata: { roleType: row.role_type },
        })),
        ...holders.rows.map((row) => ({
          id: `holder:${row.holder_address}`,
          type: GraphNodeType.Holder,
          label: row.holder_address,
        })),
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
        type: edge.type,
        label: edge.label,
        metadata: edge.metadata ?? {},
      })),
    });
  }

  private async getBodyNameMap(orgId: string): Promise<Map<string, string>> {
    const result = await this.db.query<BodyNameRow>(
      `select body_id, name from bodies where org_id = $1`,
      [orgId],
    );
    return new Map(
      result.rows.map((row) => [String(row.body_id), String(row.name)]),
    );
  }

  private async getArchiveProposalRows(
    orgId: string,
  ): Promise<ArchiveProposalRow[]> {
    const result = await this.db.query<ArchiveProposalRow>(
      `
        select
          p.chain_id::int as "chainId",
          p.org_id as "orgId",
          p.proposal_id as "proposalId",
          p.proposal_type as "proposalType",
          p.policy_version as "policyVersion",
          p.title,
          p.status,
          p.created_at_chain as "createdAtChain",
          p.queued_at_chain as "queuedAtChain",
          p.executed_at_chain as "executedAtChain",
          p.updated_at as "updatedAt",
          a.id as "accountabilityId",
          a.execution_status as "executionStatus",
          a.responsible_party_label as "responsiblePartyLabel",
          a.due_date as "dueDate",
          a.linked_tx_hash as "linkedTxHash",
          coalesce(jsonb_array_length(coalesce(a.manual_updates, '[]'::jsonb)), 0)::int as "manualUpdateCount",
          count(er.id)::int as "externalSourceCount"
        from proposals p
        left join accountability_records a
          on a.chain_id = p.chain_id
         and a.org_id = p.org_id
         and a.proposal_id = p.proposal_id
        left join external_resources er
          on er.chain_id = p.chain_id
         and er.org_id = p.org_id
         and er.proposal_id = p.proposal_id
        where p.chain_id = $1 and p.org_id = $2
        group by
          p.chain_id,
          p.org_id,
          p.proposal_id,
          p.proposal_type,
          p.policy_version,
          p.title,
          p.status,
          p.created_at_chain,
          p.queued_at_chain,
          p.executed_at_chain,
          p.updated_at,
          a.id,
          a.execution_status,
          a.responsible_party_label,
          a.due_date,
          a.linked_tx_hash,
          a.manual_updates
        order by p.proposal_id desc
      `,
      [this.config.chainId, orgId],
    );
    return result.rows;
  }

  private async getDecisionProposal(
    orgId: string,
    proposalId: string,
  ): Promise<DecisionProposalRow | undefined> {
    const result = await this.db.query<DecisionProposalRow>(
      `
        select chain_id, org_id, proposal_id, proposal_type, policy_version, title,
               target_address, value, status, created_at_chain, queued_at_chain,
               executed_at_chain, updated_at
        from proposals
        where chain_id = $1 and org_id = $2 and proposal_id = $3
      `,
      [this.config.chainId, orgId, proposalId],
    );
    return result.rows[0];
  }

  private async getAccountabilityRecordRow(
    orgId: string,
    proposalId: string,
  ): Promise<AccountabilityRecordRow | undefined> {
    const result = await this.db.query<AccountabilityRecordRow>(
      `
        select
          chain_id::int as "chainId",
          org_id as "orgId",
          proposal_id as "proposalId",
          id,
          decision_record_id as "decisionRecordId",
          responsible_party_label as "responsiblePartyLabel",
          responsible_party_wallet as "responsiblePartyWallet",
          responsible_party_external_identity_url as "responsiblePartyExternalIdentityUrl",
          due_date as "dueDate",
          execution_status as "executionStatus",
          linked_tx_hash as "linkedTxHash",
          linked_chain_id::int as "linkedChainId",
          linked_explorer_url as "linkedExplorerUrl",
          linked_tx_observed_status as "linkedTxObservedStatus",
          failure_or_cancellation_reason as "failureOrCancellationReason",
          manual_updates as "manualUpdates",
          completion_confirmation as "completionConfirmation",
          source_disclosure as "sourceDisclosure"
        from accountability_records
        where chain_id = $1 and org_id = $2 and proposal_id = $3
      `,
      [this.config.chainId, orgId, proposalId],
    );
    return result.rows[0];
  }

  private async getStoredAccountabilityRecord(
    orgId: string,
    proposalId: string,
  ): Promise<AccountabilityRecordDto | undefined> {
    const row = await this.getAccountabilityRecordRow(orgId, proposalId);
    if (!row) {
      return undefined;
    }
    const externalProofs = await this.getExternalResourceRefs(
      orgId,
      proposalId,
    );
    return this.toAccountabilityRecord(row, externalProofs);
  }

  private async getExternalResourcesForProposal(
    orgId: string,
    proposalId: string,
  ): Promise<ExternalResourceDto[]> {
    const result = await this.db.query<ExternalResourceRow>(
      `
        select
          id,
          org_id as "orgId",
          proposal_id as "proposalId",
          decision_record_id as "decisionRecordId",
          accountability_record_id as "accountabilityRecordId",
          provider,
          relation,
          url,
          canonical_ref as "canonicalRef",
          title,
          source_label as "sourceLabel",
          trust_boundary as "trustBoundary",
          authority_claim as "authorityClaim",
          import_status as "importStatus",
          observed_at as "observedAt",
          imported_at as "importedAt",
          imported_by as "importedBy",
          verification_method as "verificationMethod",
          source_disclosure as "sourceDisclosure",
          raw_metadata_preview as "rawMetadataPreview"
        from external_resources
        where chain_id = $1 and org_id = $2 and proposal_id = $3
        order by imported_at desc nulls last, observed_at desc nulls last, id asc
      `,
      [this.config.chainId, orgId, proposalId],
    );
    return result.rows.map((row) => toExternalResourceDto(row));
  }

  private async getExternalResourceRefs(
    orgId: string,
    proposalId: string,
  ): Promise<ExternalResourceRefDto[]> {
    const resources = await this.getExternalResourcesForProposal(
      orgId,
      proposalId,
    );
    return resources.map((resource) => ({
      id: resource.id,
      url: resource.url,
      sourceLabel: resource.sourceLabel,
      provider: resource.provider,
      relation: resource.relation,
      trustBoundary: resource.trustBoundary,
      authorityClaim: resource.authorityClaim,
    }));
  }

  private async toDecisionRecord(
    proposal: DecisionProposalRow,
  ): Promise<DecisionRecordDto> {
    const [accountabilityRow, evidence, approvalSummary] = await Promise.all([
      this.getAccountabilityRecordRow(proposal.org_id, proposal.proposal_id),
      this.getExternalResourceRefs(proposal.org_id, proposal.proposal_id),
      this.getDecisionApprovalSummary(proposal),
    ]);
    const accountability = accountabilityRow
      ? this.toAccountabilityRecord(accountabilityRow, evidence)
      : await this.deriveAccountabilityRecord(proposal);
    const decisionResult = toDecisionResult(proposal.status);

    return {
      id: decisionRecordIdFor(
        proposal.chain_id,
        proposal.org_id,
        proposal.proposal_id,
      ),
      orgId: proposal.org_id,
      proposalId: proposal.proposal_id,
      decisionResult,
      approvalSummary,
      requiresExecution: requiresExecution(proposal),
      accountabilityRecordId: accountability.id,
      responsiblePartyLabel: accountability.responsibleParty?.label,
      dueDate: accountability.dueDate,
      evidence,
      finalOutcome: {
        status: accountability.executionStatus,
        reason: accountabilityRow?.failureOrCancellationReason ?? undefined,
        recordedAt:
          toIsoTimestamp(proposal.updated_at) ?? new Date(0).toISOString(),
        sourceDisclosure:
          accountability.sourceDisclosure ??
          derivedSourceDisclosure(
            'Final outcome is derived from the Control Plane read model.',
          ),
      },
      timestamps: {
        proposedAt: toIsoTimestamp(proposal.created_at_chain),
        queuedAt: toIsoTimestamp(proposal.queued_at_chain),
        executedAt: toIsoTimestamp(proposal.executed_at_chain),
        archivedAt: toIsoTimestamp(proposal.updated_at),
      },
      sourceDisclosure: contractReadModelSourceDisclosure(
        'Decision records are assembled from proposal, policy, decision, accountability, and evidence read models.',
      ),
    };
  }

  private async getDecisionApprovalSummary(
    proposal: DecisionProposalRow,
  ): Promise<DecisionRecordDto['approvalSummary']> {
    const [policy, decisions] = await Promise.all([
      this.db.query<PolicyRuleRow>(
        `
          select *
          from policy_rules
          where chain_id = $1 and org_id = $2 and proposal_type = $3 and version = $4
        `,
        [
          proposal.chain_id,
          proposal.org_id,
          proposal.proposal_type,
          proposal.policy_version,
        ],
      ),
      this.db.query<ProposalDecisionRow>(
        `
          select body_id, decision_type, actor_address, tx_hash, decided_at_chain
          from proposal_decisions
          where chain_id = $1 and org_id = $2 and proposal_id = $3
        `,
        [proposal.chain_id, proposal.org_id, proposal.proposal_id],
      ),
    ]);
    const policyRow = policy.rows[0];
    const requiredApprovals = policyRow
      ? asStringArray(policyRow.required_approval_bodies)
      : [];
    const collectedApprovals = decisions.rows
      .filter((row) => row.decision_type === DecisionType.Approve)
      .map((row) => row.body_id);
    const vetoState = decisions.rows.some(
      (row) => row.decision_type === DecisionType.Veto,
    )
      ? 'vetoed'
      : policyRow
        ? 'none'
        : 'unknown';

    return {
      requiredApprovals,
      collectedApprovals,
      vetoState,
      policyVersion: proposal.policy_version,
    };
  }

  private toArchiveProposalSummary(
    row: ArchiveProposalRow,
  ): ArchiveProposalSummaryDto {
    const executionStatus = normalizeExecutionStatus(row.executionStatus);
    const linkedEvidenceCount = row.linkedTxHash ? 1 : 0;

    return {
      chainId: row.chainId,
      orgId: row.orgId,
      proposalId: row.proposalId,
      title: row.title,
      proposalType: row.proposalType,
      contractStatus: row.status,
      displayState: toArchiveDisplayState(row.status, executionStatus),
      decisionResult: toDecisionResult(row.status),
      executionStatus,
      responsiblePartyLabel: row.responsiblePartyLabel ?? undefined,
      dueDate: row.dueDate ?? undefined,
      evidenceCount: row.externalSourceCount + linkedEvidenceCount,
      externalSourceCount: row.externalSourceCount,
      lastUpdatedAt: toIsoTimestamp(row.updatedAt),
      sourceDisclosure: derivedSourceDisclosure(
        'Archive proposal summary is derived from proposal, accountability, and external-resource read models.',
      ),
    };
  }

  private toArchiveCounts(
    rows: readonly ArchiveProposalRow[],
  ): PublicOrganizationArchiveCountsDto {
    return {
      activeProposals: rows.filter((row) =>
        [ProposalStatus.Created, ProposalStatus.UnderReview].includes(
          row.status,
        ),
      ).length,
      approvedAwaitingExecution: rows.filter((row) =>
        [ProposalStatus.Approved, ProposalStatus.Queued].includes(row.status),
      ).length,
      executedDecisions: rows.filter(
        (row) =>
          row.status === ProposalStatus.Executed ||
          normalizeExecutionStatus(row.executionStatus) ===
            AccountabilityExecutionStatus.Completed,
      ).length,
      failedOrCancelledFollowThrough: rows.filter(
        (row) =>
          [
            AccountabilityExecutionStatus.Cancelled,
            AccountabilityExecutionStatus.Failed,
          ].includes(
            normalizeExecutionStatus(row.executionStatus) ??
              AccountabilityExecutionStatus.Unknown,
          ) ||
          [
            ProposalStatus.Cancelled,
            ProposalStatus.Expired,
            ProposalStatus.Vetoed,
          ].includes(row.status),
      ).length,
      proposalsWithMissingEvidence: rows.filter(
        (row) =>
          [
            ProposalStatus.Approved,
            ProposalStatus.Queued,
            ProposalStatus.Executed,
          ].includes(row.status) &&
          row.externalSourceCount === 0 &&
          !row.linkedTxHash,
      ).length,
      manualOnlyStatusRecords: rows.filter(
        (row) => row.manualUpdateCount > 0 && !row.linkedTxHash,
      ).length,
    };
  }

  private toAccountabilityRecord(
    row: AccountabilityRecordRow,
    externalProofs: readonly ExternalResourceRefDto[],
  ): AccountabilityRecordDto {
    return {
      id: row.id,
      orgId: row.orgId,
      proposalId: row.proposalId,
      decisionRecordId: row.decisionRecordId ?? undefined,
      responsibleParty: responsibleParty(row),
      dueDate: row.dueDate ?? undefined,
      executionStatus: row.executionStatus,
      linkedTransaction: row.linkedTxHash
        ? {
            chainId: row.linkedChainId ?? row.chainId,
            txHash: row.linkedTxHash,
            explorerUrl: row.linkedExplorerUrl ?? undefined,
            observedStatus:
              row.linkedTxObservedStatus ?? ObservedTransactionStatus.Unknown,
            sourceDisclosure: contractReadModelSourceDisclosure(
              'Linked transaction is an onchain observation from the Control Plane raw event stream.',
              ExternalSourceLabel.OnchainTransaction,
            ),
          }
        : undefined,
      externalProofs,
      manualUpdates: asJsonArray(row.manualUpdates),
      completionConfirmation: asJsonObject<
        NonNullable<AccountabilityRecordDto['completionConfirmation']>
      >(row.completionConfirmation),
      sourceDisclosure:
        row.sourceDisclosure ??
        contractReadModelSourceDisclosure(
          'Accountability record is materialized from Control Plane read-model projection.',
        ),
    };
  }

  private async deriveAccountabilityRecord(
    proposal: DecisionProposalRow,
  ): Promise<AccountabilityRecordDto> {
    return {
      id: accountabilityRecordIdFor(
        proposal.chain_id,
        proposal.org_id,
        proposal.proposal_id,
      ),
      orgId: proposal.org_id,
      proposalId: proposal.proposal_id,
      decisionRecordId: decisionRecordIdFor(
        proposal.chain_id,
        proposal.org_id,
        proposal.proposal_id,
      ),
      executionStatus: deriveExecutionStatus(proposal.status),
      externalProofs: await this.getExternalResourceRefs(
        proposal.org_id,
        proposal.proposal_id,
      ),
      manualUpdates: [],
      sourceDisclosure: derivedSourceDisclosure(
        'No explicit accountability row exists; this record is derived from proposal read-model state and is not a manual or external assertion.',
      ),
    };
  }

  private async getDecisionMap(
    chainId: string,
    orgId: string,
    proposalId: string,
  ): Promise<Map<string, ProposalDecisionRow>> {
    const result = await this.db.query<ProposalDecisionRow>(
      `
        select body_id, decision_type, actor_address, tx_hash, decided_at_chain
        from proposal_decisions
        where chain_id = $1 and org_id = $2 and proposal_id = $3
      `,
      [chainId, orgId, proposalId],
    );
    return new Map(
      result.rows.map((row) => [`${row.body_id}:${row.decision_type}`, row]),
    );
  }

  private executionPermissionRegistrySupported(): boolean {
    return (
      resolveExecutionPermissionRegistryCapability(this.config).status ===
      DEPLOYMENT_CAPABILITY_STATUSES.Supported
    );
  }

  private async getExecutionTargetRuleForRoute(
    proposal: ProposalRouteRow,
  ): Promise<ExecutionRouteTargetRuleRow | undefined> {
    if (
      !this.executionPermissionRegistrySupported() ||
      !proposal.target_address
    ) {
      return undefined;
    }

    const result = await this.db.query<ExecutionRouteTargetRuleRow>(
      `
        select enabled,
               max_value,
               (
                 select count(*)::int
                 from execution_selector_rules
                 where chain_id = $1 and org_id = $2 and target_address = lower($3)
               ) as selector_rule_count,
               (
                 select enabled
                 from execution_selector_rules
                 where chain_id = $1 and org_id = $2 and target_address = lower($3) and selector = lower($4)
                 limit 1
               ) as selector_enabled
        from execution_target_rules
        where chain_id = $1 and org_id = $2 and target_address = lower($3)
        limit 1
      `,
      [
        proposal.chain_id,
        proposal.org_id,
        proposal.target_address,
        proposal.action_selector,
      ],
    );
    return result.rows[0];
  }

  private resolveFinalizationStatus(
    storedStatus: string,
  ): OrganizationFinalizationReadModelDto['finalizationStatus'] {
    const capabilityStatus = toOrganizationFinalizationCapabilityStatus(
      resolveOrganizationFinalizationCapability(this.config),
    );
    if (capabilityStatus === ORGANIZATION_FINALIZATION_STATUSES.Unknown) {
      return ORGANIZATION_FINALIZATION_STATUSES.Unknown;
    }
    if (capabilityStatus === ORGANIZATION_FINALIZATION_STATUSES.Unsupported) {
      return ORGANIZATION_FINALIZATION_STATUSES.Unsupported;
    }
    if (storedStatus === ORGANIZATION_FINALIZATION_STATUSES.Finalized) {
      return ORGANIZATION_FINALIZATION_STATUSES.Finalized;
    }
    if (storedStatus === ORGANIZATION_FINALIZATION_STATUSES.NotFinalized) {
      return ORGANIZATION_FINALIZATION_STATUSES.NotFinalized;
    }
    return ORGANIZATION_FINALIZATION_STATUSES.Unknown;
  }
}

function lifecycleStatus(
  organizationStatus: OrganizationStatus,
  finalizationStatus: OrganizationFinalizationReadModelDto['finalizationStatus'],
): OrganizationFinalizationReadModelDto['lifecycleStatus'] {
  if (finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.Unsupported) {
    return ORGANIZATION_LIFECYCLE_STATUSES.Unsupported;
  }
  if (finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.Unknown) {
    return ORGANIZATION_LIFECYCLE_STATUSES.Unknown;
  }
  if (finalizationStatus === ORGANIZATION_FINALIZATION_STATUSES.Finalized) {
    return ORGANIZATION_LIFECYCLE_STATUSES.Finalized;
  }
  if (organizationStatus === OrganizationStatus.Active) {
    return ORGANIZATION_LIFECYCLE_STATUSES.ActiveNotFinalized;
  }
  return ORGANIZATION_LIFECYCLE_STATUSES.Unknown;
}

function toExecutionTargetRule(
  row: ExecutionTargetRuleRow,
): ExecutionTargetRuleDto {
  return normalizeRow<ExecutionTargetRuleDto>({
    orgId: row.orgId,
    targetAddress: row.targetAddress.toLowerCase(),
    enabled: row.enabled,
    maxValue: row.maxValue,
    updatedAtBlockNumber: row.updatedAtBlockNumber,
    updatedAtTxHash: row.updatedAtTxHash,
    updatedByAddress: row.updatedByAddress?.toLowerCase(),
  });
}

function toExecutionSelectorRule(
  row: ExecutionSelectorRuleRow,
): ExecutionSelectorRuleDto {
  return normalizeRow<ExecutionSelectorRuleDto>({
    orgId: row.orgId,
    targetAddress: row.targetAddress.toLowerCase(),
    selector: row.selector.toLowerCase(),
    enabled: row.enabled,
    updatedAtBlockNumber: row.updatedAtBlockNumber,
    updatedAtTxHash: row.updatedAtTxHash,
    updatedByAddress: row.updatedByAddress?.toLowerCase(),
  });
}

function toOrgExecutorDto(row: OrgExecutorRow): OrgExecutorDto {
  return normalizeRow<OrgExecutorDto>({
    orgId: row.orgId,
    executorAddress: activeExecutorAddress(row.executorAddress),
    previousExecutorAddress: activeExecutorAddress(row.previousExecutorAddress),
    updatedByAddress: row.updatedByAddress?.toLowerCase(),
    updatedAt: toIsoTimestamp(row.updatedAt),
    transactionHash: row.transactionHash,
    blockNumber: row.blockNumber,
  });
}

function toProposalDto(row: ProposalReadRow): ProposalDto {
  const executionReceipt = toProposalExecutionReceipt(row);
  return normalizeRow<ProposalDto>({
    chainId: row.chainId,
    orgId: row.orgId,
    proposalId: row.proposalId,
    proposalType: row.proposalType,
    policyVersion: row.policyVersion,
    title: row.title,
    descriptionUri: row.descriptionUri,
    targetAddress: row.targetAddress,
    value: row.value,
    actionSelector: row.actionSelector,
    dataHash: row.dataHash,
    creatorAddress: row.creatorAddress,
    status: row.status,
    createdBlock: row.createdBlock,
    createdTxHash: row.createdTxHash,
    createdAtChain: row.createdAtChain,
    queuedAtChain: row.queuedAtChain,
    executableAtChain: row.executableAtChain,
    executedAtChain: row.executedAtChain,
    executionMode: executionReceipt?.executionMode,
    managedExecutorAddress: executionReceipt?.managedExecutorAddress,
    executionReceipt,
    dataStatus: row.dataStatus,
  });
}

function toProposalExecutionReceipt(
  row: ProposalReadRow,
): ProposalExecutionReceiptDto | undefined {
  if (
    !row.receiptExecutorAddress ||
    !row.receiptTargetAddress ||
    !row.receiptValue ||
    !row.receiptActionSelector ||
    !row.receiptDataHash ||
    !row.receiptExecutionMode
  ) {
    return undefined;
  }

  return normalizeRow<ProposalExecutionReceiptDto>({
    orgId: row.orgId,
    proposalId: row.proposalId,
    executorAddress: row.receiptExecutorAddress,
    targetAddress: row.receiptTargetAddress,
    value: row.receiptValue,
    actionSelector: row.receiptActionSelector,
    dataHash: row.receiptDataHash,
    executionMode: row.receiptExecutionMode,
    managedExecutorAddress: activeExecutorAddress(
      row.receiptManagedExecutorAddress,
    ),
    transactionHash: row.receiptTransactionHash,
    blockNumber: row.receiptBlockNumber,
    observedAt: toIsoTimestamp(row.receiptObservedAt),
  });
}

function activeExecutorAddress(
  value: Address | null | undefined,
): Address | undefined {
  if (!value || value.toLowerCase() === ZERO_ADDRESS) {
    return undefined;
  }
  return value.toLowerCase() as Address;
}

function isValueExceedingLimit(value: string, maxValue: string): boolean {
  return BigInt(value) > BigInt(maxValue);
}

function reason(
  code: RouteBlockedReasonCode,
  message: string,
  relatedBodyId?: string,
): RouteBlockedReasonDto {
  return relatedBodyId ? { code, message, relatedBodyId } : { code, message };
}

function accountabilityRecordIdFor(
  chainId: string,
  orgId: string,
  proposalId: string,
): string {
  return `accountability:${chainId}:${orgId}:${proposalId}`;
}

function decisionRecordIdFor(
  chainId: string,
  orgId: string,
  proposalId: string,
): string {
  return `decision:${chainId}:${orgId}:${proposalId}`;
}

function normalizeExecutionStatus(
  value: string | null,
): AccountabilityExecutionStatus | undefined {
  if (!value) {
    return undefined;
  }
  if (
    Object.values(AccountabilityExecutionStatus).includes(
      value as AccountabilityExecutionStatus,
    )
  ) {
    return value as AccountabilityExecutionStatus;
  }
  return AccountabilityExecutionStatus.Unknown;
}

function deriveExecutionStatus(
  proposalStatus: ProposalStatus,
): AccountabilityExecutionStatus {
  if (proposalStatus === ProposalStatus.Executed) {
    return AccountabilityExecutionStatus.Completed;
  }
  if (proposalStatus === ProposalStatus.Cancelled) {
    return AccountabilityExecutionStatus.Cancelled;
  }
  return AccountabilityExecutionStatus.Unknown;
}

function toArchiveDisplayState(
  proposalStatus: ProposalStatus,
  executionStatus: AccountabilityExecutionStatus | undefined,
): ArchiveProposalDisplayState {
  if (executionStatus === AccountabilityExecutionStatus.Completed) {
    return ArchiveProposalDisplayState.Executed;
  }
  if (executionStatus === AccountabilityExecutionStatus.Failed) {
    return ArchiveProposalDisplayState.ExecutionFailed;
  }
  if (executionStatus === AccountabilityExecutionStatus.Cancelled) {
    return ArchiveProposalDisplayState.Cancelled;
  }

  switch (proposalStatus) {
    case ProposalStatus.Created:
    case ProposalStatus.UnderReview:
      return ArchiveProposalDisplayState.Active;
    case ProposalStatus.Approved:
      return ArchiveProposalDisplayState.Approved;
    case ProposalStatus.Queued:
      return ArchiveProposalDisplayState.ExecutionPending;
    case ProposalStatus.Executed:
      return ArchiveProposalDisplayState.Executed;
    case ProposalStatus.Cancelled:
      return ArchiveProposalDisplayState.Cancelled;
    case ProposalStatus.Vetoed:
      return ArchiveProposalDisplayState.Rejected;
    case ProposalStatus.Expired:
      return ArchiveProposalDisplayState.Archived;
    default:
      return ArchiveProposalDisplayState.UnknownExternalState;
  }
}

function toDecisionResult(
  proposalStatus: ProposalStatus,
): DecisionRecordResult {
  switch (proposalStatus) {
    case ProposalStatus.Approved:
    case ProposalStatus.Queued:
      return DecisionRecordResult.Approved;
    case ProposalStatus.Executed:
      return DecisionRecordResult.Executed;
    case ProposalStatus.Cancelled:
      return DecisionRecordResult.Cancelled;
    case ProposalStatus.Vetoed:
      return DecisionRecordResult.Rejected;
    case ProposalStatus.Expired:
      return DecisionRecordResult.Expired;
    default:
      return DecisionRecordResult.Unknown;
  }
}

function requiresExecution(proposal: DecisionProposalRow): boolean {
  return (
    proposal.status === ProposalStatus.Approved ||
    proposal.status === ProposalStatus.Queued ||
    proposal.status === ProposalStatus.Executed ||
    Boolean(proposal.target_address) ||
    Number(proposal.value) > 0
  );
}

function responsibleParty(
  row: AccountabilityRecordRow,
): AccountabilityRecordDto['responsibleParty'] {
  if (
    !row.responsiblePartyLabel &&
    !row.responsiblePartyWallet &&
    !row.responsiblePartyExternalIdentityUrl
  ) {
    return undefined;
  }
  return {
    label: row.responsiblePartyLabel ?? 'Unspecified responsible party',
    walletAddress: row.responsiblePartyWallet ?? undefined,
    externalIdentityUrl: row.responsiblePartyExternalIdentityUrl ?? undefined,
  };
}

function contractReadModelSourceDisclosure(
  note: string,
  sourceLabel = ExternalSourceLabel.ContractState,
): SourceDisclosureDto {
  return {
    sourceCategory: GovernanceRecordSourceCategory.ContractReadModel,
    sourceLabel,
    trustBoundary: ExternalTrustBoundary.OnchainObservation,
    authorityClaim: ExternalAuthorityClaim.ContractAuthoritative,
    note,
  };
}

function derivedSourceDisclosure(note: string): SourceDisclosureDto {
  return {
    sourceCategory: GovernanceRecordSourceCategory.DerivedDisplay,
    sourceLabel: ExternalSourceLabel.ContractState,
    trustBoundary: ExternalTrustBoundary.OnchainObservation,
    authorityClaim: ExternalAuthorityClaim.None,
    note,
  };
}

function toExternalResourceDto(row: ExternalResourceRow): ExternalResourceDto {
  return {
    id: row.id,
    orgId: row.orgId,
    proposalId: row.proposalId ?? undefined,
    decisionRecordId: row.decisionRecordId ?? undefined,
    accountabilityRecordId: row.accountabilityRecordId ?? undefined,
    provider: row.provider,
    relation: row.relation,
    url: row.url,
    canonicalRef: row.canonicalRef ?? undefined,
    title: row.title ?? undefined,
    sourceLabel: row.sourceLabel,
    trustBoundary: row.trustBoundary,
    authorityClaim: row.authorityClaim,
    importStatus:
      (row.importStatus as ExternalResourceDto['importStatus']) ?? undefined,
    observedAt: toIsoTimestamp(row.observedAt),
    importedAt: toIsoTimestamp(row.importedAt),
    importedBy: row.importedBy ?? undefined,
    verificationMethod: row.verificationMethod ?? undefined,
    sourceDisclosure: row.sourceDisclosure ?? undefined,
    rawMetadataPreview: row.rawMetadataPreview ?? undefined,
  };
}

function asJsonArray(value: unknown): AccountabilityRecordDto['manualUpdates'] {
  if (Array.isArray(value)) {
    return value as AccountabilityRecordDto['manualUpdates'];
  }
  return [];
}

function asJsonObject<T extends object>(value: unknown): T | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return undefined;
}

function toIsoTimestamp(
  value: Date | string | null | undefined,
): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return new Date(numeric * 1_000).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
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
