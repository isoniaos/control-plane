import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { asString, asStringArray } from '../chain/json';
import { AppConfigService } from '../config/app-config.service';
import {
  toBodyKind,
  toOrganizationStatus,
  toProposalStatus,
  toProposalType,
  toRoleType,
} from '../chain/governance-events';
import { DatabaseService } from '../database/database.service';
import {
  AccountabilityExecutionStatus,
  DataStatus,
  DecisionType,
  ExternalAuthorityClaim,
  ExternalSourceLabel,
  ExternalTrustBoundary,
  GovernanceEventName,
  GovernanceRecordSourceCategory,
  GraphEdgeType,
  GraphNodeType,
  ObservedTransactionStatus,
  ORGANIZATION_FINALIZATION_STATUSES,
  OrganizationStatus,
  ProposalExecutionMode,
  ProposalStatus,
} from '@isonia/types';

interface RawEventRow {
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

export interface LastProjectedCursor {
  readonly blockNumber: string;
  readonly txHash: `0x${string}`;
  readonly logIndex: number;
  readonly processedAt: string;
}

interface LastProjectedCursorRow {
  readonly block_number: string;
  readonly tx_hash: string;
  readonly log_index: number;
  readonly processed_at: Date | string;
}

interface ProposalPolicyLookupRow {
  readonly required_approval_bodies: unknown;
}

@Injectable()
export class ProjectionService {
  private readonly logger = new Logger(ProjectionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: AppConfigService,
  ) {}

  async processBatch(limit = 100): Promise<number> {
    let processed = 0;
    for (let index = 0; index < limit; index += 1) {
      const didProcess = await this.processNextEvent();
      if (!didProcess) {
        break;
      }
      processed += 1;
    }

    if (processed > 0) {
      this.logger.log(`Projected ${processed} raw events`);
    }
    return processed;
  }

  async processUntilIdle(batchSize = 100): Promise<number> {
    let total = 0;
    for (;;) {
      const processed = await this.processBatch(batchSize);
      total += processed;
      if (processed === 0) {
        return total;
      }
    }
  }

  async rebuild(): Promise<number> {
    await this.db.resetReadModels();
    return this.processUntilIdle();
  }

  async retryFailedEvents(): Promise<number> {
    const result = await this.db.query(
      `
        update raw_events
        set failed_at = null,
            error = null,
            updated_at = now()
        where chain_id = $1
          and status = 'confirmed'
          and processed_at is null
          and failed_at is not null
      `,
      [this.config.chainId],
    );
    return result.rowCount ?? 0;
  }

  async getLastProjectedCursor(): Promise<LastProjectedCursor | null> {
    const result = await this.db.query<LastProjectedCursorRow>(
      `
        select block_number, tx_hash, log_index, processed_at
        from raw_events
        where chain_id = $1 and processed_at is not null and status = 'confirmed'
        order by block_number desc, log_index desc
        limit 1
      `,
      [this.config.chainId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      blockNumber: row.block_number,
      txHash: row.tx_hash as `0x${string}`,
      logIndex: row.log_index,
      processedAt:
        row.processed_at instanceof Date
          ? row.processed_at.toISOString()
          : row.processed_at,
    };
  }

  private async processNextEvent(): Promise<boolean> {
    let selectedEvent: RawEventRow | undefined;
    try {
      return await this.db.transaction(async (client) => {
        const result = await client.query<RawEventRow>(
          `
            select *
            from raw_events
            where chain_id = $1
              and status = 'confirmed'
              and processed_at is null
              and failed_at is null
            order by block_number asc, log_index asc
            limit 1
            for update skip locked
          `,
          [this.config.chainId],
        );
        selectedEvent = result.rows[0];
        if (!selectedEvent) {
          return false;
        }

        const event = selectedEvent;
        await this.applyEvent(client, event);
        await client.query(
          `update raw_events set processed_at = now(), failed_at = null, error = null, updated_at = now() where id = $1`,
          [event.id],
        );
        return true;
      });
    } catch (error) {
      if (selectedEvent) {
        await this.markEventFailed(selectedEvent.id, error);
      }
      throw error;
    }
  }

  private async markEventFailed(
    eventId: string,
    error: unknown,
  ): Promise<void> {
    await this.db.query(
      `
        update raw_events
        set failed_at = now(),
            error = $2,
            processing_attempts = processing_attempts + 1,
            updated_at = now()
        where id = $1 and processed_at is null
      `,
      [eventId, error instanceof Error ? error.message : String(error)],
    );
  }

  private async applyEvent(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    switch (event.event_name) {
      case GovernanceEventName.OrganizationCreated:
        return this.organizationCreated(client, event);
      case GovernanceEventName.OrganizationUpdated:
        return this.organizationUpdated(client, event);
      case GovernanceEventName.OrganizationStatusChanged:
        return this.organizationStatusChanged(client, event);
      case GovernanceEventName.OrganizationFinalized:
        return this.organizationFinalized(client, event);
      case GovernanceEventName.BodyCreated:
        return this.bodyCreated(client, event);
      case GovernanceEventName.BodyUpdated:
        return this.bodyUpdated(client, event);
      case GovernanceEventName.RoleCreated:
        return this.roleCreated(client, event);
      case GovernanceEventName.RoleUpdated:
        return this.roleUpdated(client, event);
      case GovernanceEventName.MandateAssigned:
        return this.mandateAssigned(client, event);
      case GovernanceEventName.MandateRevoked:
        return this.mandateRevoked(client, event);
      case GovernanceEventName.PolicyRuleSet:
        return this.policyRuleSet(client, event);
      case GovernanceEventName.ExecutionTargetRuleUpdated:
        return this.executionTargetRuleUpdated(client, event);
      case GovernanceEventName.ExecutionSelectorRuleUpdated:
        return this.executionSelectorRuleUpdated(client, event);
      case GovernanceEventName.OrgExecutorUpdated:
        return this.orgExecutorUpdated(client, event);
      case GovernanceEventName.ProposalCreated:
        return this.proposalCreated(client, event);
      case GovernanceEventName.ProposalApproved:
        return this.proposalDecision(client, event, DecisionType.Approve);
      case GovernanceEventName.ProposalVetoed:
        return this.proposalDecision(client, event, DecisionType.Veto);
      case GovernanceEventName.ProposalQueued:
        return this.proposalQueued(client, event);
      case GovernanceEventName.ProposalExecuted:
        return this.proposalExecuted(client, event);
      case GovernanceEventName.ProposalCancelled:
        return this.proposalCancelled(client, event);
      case GovernanceEventName.ProposalStatusChanged:
        return this.proposalStatusChanged(client, event);
      default:
        return undefined;
    }
  }

  private async organizationCreated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const args = event.args;
    const orgId = stringArg(args, 'orgId');
    const slug = stringArg(args, 'slug');
    const adminAddress = arg(args, 'adminAddress', 'admin');
    const metadataUri = arg(args, 'metadataUri', 'metadataURI');
    await client.query(
      `
        insert into organizations (
          chain_id, org_id, admin_address, slug, name, metadata_uri, status,
          finalization_status, created_block, created_tx_hash, data_status
        )
        values ($1, $2, lower($3), $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (chain_id, org_id) do update set
          admin_address = excluded.admin_address,
          slug = excluded.slug,
          name = excluded.name,
          metadata_uri = excluded.metadata_uri,
          status = excluded.status,
          finalization_status = case
            when organizations.finalization_status = $12 then organizations.finalization_status
            else excluded.finalization_status
          end,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [
        event.chain_id,
        orgId,
        adminAddress,
        slug,
        fallbackName('Organization', orgId, slug),
        metadataUri,
        OrganizationStatus.Active,
        ORGANIZATION_FINALIZATION_STATUSES.NotFinalized,
        event.block_number,
        event.tx_hash,
        event.status,
        ORGANIZATION_FINALIZATION_STATUSES.Finalized,
      ],
    );
  }

  private async organizationUpdated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `update organizations set metadata_uri = $3, updated_at = now() where chain_id = $1 and org_id = $2`,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        arg(event.args, 'metadataUri', 'metadataURI'),
      ],
    );
  }

  private async organizationStatusChanged(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `update organizations set status = $3, updated_at = now() where chain_id = $1 and org_id = $2`,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        toOrganizationStatus(arg(event.args, 'status')),
      ],
    );
  }

  private async organizationFinalized(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `
        update organizations
        set finalization_status = $3,
            finalized_admin_address = lower($4),
            finalized_block = $5,
            finalized_tx_hash = $6,
            finalized_at_chain = $7,
            updated_at = now()
        where chain_id = $1 and org_id = $2
      `,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        ORGANIZATION_FINALIZATION_STATUSES.Finalized,
        arg(event.args, 'admin'),
        event.block_number,
        event.tx_hash,
        event.block_timestamp,
      ],
    );
  }

  private async bodyCreated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const bodyId = stringArg(event.args, 'bodyId');
    const orgId = stringArg(event.args, 'orgId');
    await client.query(
      `
        insert into bodies (chain_id, body_id, org_id, kind, name, metadata_uri, active, created_block, data_status)
        values ($1, $2, $3, $4, $5, $6, true, $7, $8)
        on conflict (chain_id, org_id, body_id) do update set
          org_id = excluded.org_id,
          kind = excluded.kind,
          name = excluded.name,
          metadata_uri = excluded.metadata_uri,
          active = excluded.active,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [
        event.chain_id,
        bodyId,
        orgId,
        toBodyKind(arg(event.args, 'kind')),
        fallbackName('Body', bodyId),
        arg(event.args, 'metadataUri', 'metadataURI'),
        event.block_number,
        event.status,
      ],
    );
    await upsertEdge(
      client,
      event,
      orgId,
      GraphNodeType.Organization,
      orgId,
      GraphNodeType.Body,
      bodyId,
      GraphEdgeType.Contains,
      undefined,
    );
  }

  private async bodyUpdated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `update bodies set active = $4, metadata_uri = $5, updated_at = now() where chain_id = $1 and org_id = $2 and body_id = $3`,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'bodyId'),
        Boolean(arg(event.args, 'active')),
        arg(event.args, 'metadataUri', 'metadataURI'),
      ],
    );
  }

  private async roleCreated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const roleId = stringArg(event.args, 'roleId');
    const orgId = stringArg(event.args, 'orgId');
    const bodyId = stringArg(event.args, 'bodyId');
    const roleType = toRoleType(arg(event.args, 'roleType'));
    await client.query(
      `
        insert into roles (chain_id, role_id, org_id, body_id, role_type, name, metadata_uri, active, data_status)
        values ($1, $2, $3, $4, $5, $6, $7, true, $8)
        on conflict (chain_id, org_id, role_id) do update set
          org_id = excluded.org_id,
          body_id = excluded.body_id,
          role_type = excluded.role_type,
          name = excluded.name,
          metadata_uri = excluded.metadata_uri,
          active = excluded.active,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [
        event.chain_id,
        roleId,
        orgId,
        bodyId,
        roleType,
        fallbackName('Role', roleId, roleType),
        arg(event.args, 'metadataUri', 'metadataURI'),
        event.status,
      ],
    );
    await upsertEdge(
      client,
      event,
      orgId,
      GraphNodeType.Body,
      bodyId,
      GraphNodeType.Role,
      roleId,
      GraphEdgeType.Contains,
      roleType,
    );
  }

  private async roleUpdated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `update roles set active = $4, metadata_uri = $5, updated_at = now() where chain_id = $1 and org_id = $2 and role_id = $3`,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'roleId'),
        Boolean(arg(event.args, 'active')),
        arg(event.args, 'metadataUri', 'metadataURI'),
      ],
    );
  }

  private async mandateAssigned(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const mandateId = stringArg(event.args, 'mandateId');
    const orgId = stringArg(event.args, 'orgId');
    const roleId = stringArg(event.args, 'roleId');
    const bodyId = stringArg(event.args, 'bodyId');
    const holder = stringArg(
      event.args,
      'holderAddress',
      'holder',
    ).toLowerCase();
    await client.query(
      `
        insert into mandates (
          chain_id, mandate_id, org_id, body_id, role_id, holder_address, start_time,
          end_time, proposal_type_mask, spending_limit, active, revoked, data_status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false, $11)
        on conflict (chain_id, org_id, mandate_id) do update set
          body_id = excluded.body_id,
          role_id = excluded.role_id,
          holder_address = excluded.holder_address,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          proposal_type_mask = excluded.proposal_type_mask,
          spending_limit = excluded.spending_limit,
          active = true,
          revoked = false,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [
        event.chain_id,
        mandateId,
        orgId,
        bodyId,
        roleId,
        holder,
        stringArg(event.args, 'startTime'),
        stringArg(event.args, 'endTime'),
        stringArg(event.args, 'proposalTypeMask'),
        stringArg(event.args, 'spendingLimit'),
        event.status,
      ],
    );
    await upsertEdge(
      client,
      event,
      orgId,
      GraphNodeType.Holder,
      holder,
      GraphNodeType.Role,
      roleId,
      GraphEdgeType.Holds,
      undefined,
    );
  }

  private async mandateRevoked(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `update mandates set active = false, revoked = true, updated_at = now() where chain_id = $1 and org_id = $2 and mandate_id = $3`,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'mandateId'),
      ],
    );
  }

  private async policyRuleSet(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const orgId = stringArg(event.args, 'orgId');
    const proposalType = toProposalType(arg(event.args, 'proposalType'));
    const version = stringArg(event.args, 'version');
    const requiredApprovalBodies = asStringArray(
      arg(event.args, 'requiredApprovalBodies'),
    );
    const vetoBodies = asStringArray(arg(event.args, 'vetoBodies'));
    const executorBody = stringArg(event.args, 'executorBody');
    const params = [
      event.chain_id,
      orgId,
      proposalType,
      version,
      JSON.stringify(requiredApprovalBodies),
      JSON.stringify(vetoBodies),
      executorBody === '0' ? null : executorBody,
      stringArg(event.args, 'timelockSeconds'),
      Boolean(arg(event.args, 'enabled')),
      event.status,
    ];
    await client.query(
      `
        insert into policy_rules (
          chain_id, org_id, proposal_type, version, required_approval_bodies,
          veto_bodies, executor_body, timelock_seconds, enabled, data_status
        )
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
        on conflict (chain_id, org_id, proposal_type, version) do update set
          required_approval_bodies = excluded.required_approval_bodies,
          veto_bodies = excluded.veto_bodies,
          executor_body = excluded.executor_body,
          timelock_seconds = excluded.timelock_seconds,
          enabled = excluded.enabled,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      params,
    );
    await client.query(
      `
        insert into current_policy_rules (
          chain_id, org_id, proposal_type, version, required_approval_bodies,
          veto_bodies, executor_body, timelock_seconds, enabled, data_status
        )
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
        on conflict (chain_id, org_id, proposal_type) do update set
          version = excluded.version,
          required_approval_bodies = excluded.required_approval_bodies,
          veto_bodies = excluded.veto_bodies,
          executor_body = excluded.executor_body,
          timelock_seconds = excluded.timelock_seconds,
          enabled = excluded.enabled,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      params,
    );
    for (const bodyId of requiredApprovalBodies) {
      await upsertEdge(
        client,
        event,
        orgId,
        GraphNodeType.ProposalType,
        proposalType,
        GraphNodeType.Body,
        bodyId,
        GraphEdgeType.RequiresApproval,
        undefined,
      );
    }
    for (const bodyId of vetoBodies) {
      await upsertEdge(
        client,
        event,
        orgId,
        GraphNodeType.ProposalType,
        proposalType,
        GraphNodeType.Body,
        bodyId,
        GraphEdgeType.CanVeto,
        undefined,
      );
    }
    if (executorBody !== '0') {
      await upsertEdge(
        client,
        event,
        orgId,
        GraphNodeType.ProposalType,
        proposalType,
        GraphNodeType.Body,
        executorBody,
        GraphEdgeType.CanExecute,
        undefined,
      );
    }
  }

  private async executionTargetRuleUpdated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `
        insert into execution_target_rules (
          chain_id,
          org_id,
          target_address,
          enabled,
          max_value,
          updated_at_block_number,
          updated_at_tx_hash,
          updated_at_log_index,
          updated_by_address,
          updated_at
        )
        values ($1, $2, lower($3), $4, $5, $6, $7, $8, lower($9), now())
        on conflict (chain_id, org_id, target_address) do update set
          enabled = excluded.enabled,
          max_value = excluded.max_value,
          updated_at_block_number = excluded.updated_at_block_number,
          updated_at_tx_hash = excluded.updated_at_tx_hash,
          updated_at_log_index = excluded.updated_at_log_index,
          updated_by_address = excluded.updated_by_address,
          updated_at = now()
      `,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        arg(event.args, 'targetAddress', 'target'),
        Boolean(arg(event.args, 'enabled')),
        stringArg(event.args, 'maxValue'),
        event.block_number,
        event.tx_hash,
        event.log_index,
        arg(event.args, 'actorAddress', 'actor'),
      ],
    );
  }

  private async executionSelectorRuleUpdated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `
        insert into execution_selector_rules (
          chain_id,
          org_id,
          target_address,
          selector,
          enabled,
          updated_at_block_number,
          updated_at_tx_hash,
          updated_at_log_index,
          updated_by_address,
          updated_at
        )
        values ($1, $2, lower($3), lower($4), $5, $6, $7, $8, lower($9), now())
        on conflict (chain_id, org_id, target_address, selector) do update set
          enabled = excluded.enabled,
          updated_at_block_number = excluded.updated_at_block_number,
          updated_at_tx_hash = excluded.updated_at_tx_hash,
          updated_at_log_index = excluded.updated_at_log_index,
          updated_by_address = excluded.updated_by_address,
          updated_at = now()
      `,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        arg(event.args, 'targetAddress', 'target'),
        stringArg(event.args, 'selector'),
        Boolean(arg(event.args, 'enabled')),
        event.block_number,
        event.tx_hash,
        event.log_index,
        arg(event.args, 'actorAddress', 'actor'),
      ],
    );
  }

  private async orgExecutorUpdated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `
        insert into org_executors (
          chain_id,
          org_id,
          executor_address,
          previous_executor_address,
          updated_by_address,
          updated_tx_hash,
          updated_block_number,
          updated_at,
          raw_event_id
        )
        values ($1, $2, lower($3), lower($4), lower($5), $6, $7, now(), $8)
        on conflict (chain_id, org_id) do update set
          executor_address = excluded.executor_address,
          previous_executor_address = excluded.previous_executor_address,
          updated_by_address = excluded.updated_by_address,
          updated_tx_hash = excluded.updated_tx_hash,
          updated_block_number = excluded.updated_block_number,
          updated_at = now(),
          raw_event_id = excluded.raw_event_id
      `,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        arg(event.args, 'newExecutorAddress', 'newExecutor'),
        arg(event.args, 'previousExecutorAddress', 'previousExecutor'),
        arg(event.args, 'actorAddress', 'actor'),
        event.tx_hash,
        event.block_number,
        event.id,
      ],
    );
  }

  private async proposalCreated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const proposalId = stringArg(event.args, 'proposalId');
    const orgId = stringArg(event.args, 'orgId');
    const proposalType = toProposalType(arg(event.args, 'proposalType'));
    const metadataUri = stringArg(event.args, 'metadataUri', 'metadataURI');
    const policy = await client.query<ProposalPolicyLookupRow>(
      `
        select required_approval_bodies
        from policy_rules
        where chain_id = $1 and org_id = $2 and proposal_type = $3 and version = $4
      `,
      [
        event.chain_id,
        orgId,
        proposalType,
        stringArg(event.args, 'policyVersion'),
      ],
    );
    const requiredApprovalBodies = asStringArray(
      policy.rows[0]?.required_approval_bodies ?? [],
    );
    const initialStatus =
      requiredApprovalBodies.length === 0
        ? ProposalStatus.Approved
        : ProposalStatus.UnderReview;
    await client.query(
      `
        insert into proposals (
          chain_id, proposal_id, org_id, proposal_type, policy_version, title,
          target_address, value, action_selector, data_hash, creator_address, status, created_block,
          created_tx_hash, created_at_chain, metadata_uri, data_status
        )
        values ($1, $2, $3, $4, $5, $6, lower($7), $8, lower($9), $10, lower($11), $12, $13, $14, $15, $16, $17)
        on conflict (chain_id, org_id, proposal_id) do update set
          proposal_type = excluded.proposal_type,
          policy_version = excluded.policy_version,
          title = excluded.title,
          target_address = excluded.target_address,
          value = excluded.value,
          action_selector = excluded.action_selector,
          data_hash = excluded.data_hash,
          creator_address = excluded.creator_address,
          status = excluded.status,
          metadata_uri = excluded.metadata_uri,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [
        event.chain_id,
        proposalId,
        orgId,
        proposalType,
        stringArg(event.args, 'policyVersion'),
        fallbackName('Proposal', proposalId, metadataUri),
        arg(event.args, 'targetAddress', 'target'),
        stringArg(event.args, 'value'),
        optionalStringArg(event.args, 'actionSelector'),
        arg(event.args, 'dataHash'),
        arg(event.args, 'creatorAddress', 'creator'),
        initialStatus,
        event.block_number,
        event.tx_hash,
        event.block_timestamp ?? '0',
        metadataUri,
        event.status,
      ],
    );
    await upsertEdge(
      client,
      event,
      orgId,
      GraphNodeType.Proposal,
      proposalId,
      GraphNodeType.ProposalType,
      proposalType,
      GraphEdgeType.Contains,
      undefined,
    );
  }

  private async proposalDecision(
    client: PoolClient,
    event: RawEventRow,
    decisionType: DecisionType,
  ): Promise<void> {
    await client.query(
      `
        insert into proposal_decisions (
          chain_id, org_id, proposal_id, body_id, actor_address, decision_type,
          tx_hash, block_number, log_index, decided_at_chain, data_status
        )
        values ($1, $2, $3, $4, lower($5), $6, $7, $8, $9, $10, $11)
        on conflict (chain_id, org_id, proposal_id, body_id, decision_type) do update set
          actor_address = excluded.actor_address,
          tx_hash = excluded.tx_hash,
          block_number = excluded.block_number,
          log_index = excluded.log_index,
          decided_at_chain = excluded.decided_at_chain,
          data_status = excluded.data_status
      `,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'proposalId'),
        stringArg(event.args, 'bodyId'),
        arg(event.args, 'actorAddress', 'actor'),
        decisionType,
        event.tx_hash,
        event.block_number,
        event.log_index,
        event.block_timestamp ?? '0',
        event.status,
      ],
    );
  }

  private async proposalQueued(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `
        update proposals
        set status = $4,
            queued_at_chain = $5,
            executable_at_chain = $6,
            updated_at = now()
        where chain_id = $1 and org_id = $2 and proposal_id = $3
      `,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'proposalId'),
        ProposalStatus.Queued,
        stringArg(event.args, 'queuedAt'),
        stringArg(event.args, 'executableAt'),
      ],
    );
  }

  private async proposalExecuted(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const orgId = stringArg(event.args, 'orgId');
    const proposalId = stringArg(event.args, 'proposalId');
    const receipt = proposalExecutionReceipt(event);
    await client.query(
      `
        update proposals
        set status = $4,
            executed_at_chain = $5,
            updated_at = now()
        where chain_id = $1 and org_id = $2 and proposal_id = $3
      `,
      [
        event.chain_id,
        orgId,
        proposalId,
        ProposalStatus.Executed,
        event.block_timestamp ?? '0',
      ],
    );
    if (receipt) {
      await client.query(
        `
          insert into proposal_execution_receipts (
            chain_id,
            org_id,
            proposal_id,
            tx_hash,
            block_number,
            executor_address,
            target_address,
            value,
            action_selector,
            data_hash,
            execution_mode,
            managed_executor_address,
            observed_at,
            raw_event_id
          )
          values ($1, $2, $3, $4, $5, lower($6), lower($7), $8, lower($9), $10, $11, lower($12), now(), $13)
          on conflict (chain_id, org_id, proposal_id) do update set
            tx_hash = excluded.tx_hash,
            block_number = excluded.block_number,
            executor_address = excluded.executor_address,
            target_address = excluded.target_address,
            value = excluded.value,
            action_selector = excluded.action_selector,
            data_hash = excluded.data_hash,
            execution_mode = excluded.execution_mode,
            managed_executor_address = excluded.managed_executor_address,
            observed_at = now(),
            raw_event_id = excluded.raw_event_id
        `,
        [
          event.chain_id,
          orgId,
          proposalId,
          event.tx_hash,
          event.block_number,
          receipt.executorAddress,
          receipt.targetAddress,
          receipt.value,
          receipt.actionSelector,
          receipt.dataHash,
          receipt.executionMode,
          receipt.managedExecutorAddress,
          event.id,
        ],
      );
    }
    await this.upsertAccountabilityRecord(
      client,
      event,
      orgId,
      proposalId,
      AccountabilityExecutionStatus.Completed,
      {
        linkedTxHash: event.tx_hash,
        linkedObservedStatus: ObservedTransactionStatus.Confirmed,
        targetAddress: stringArg(event.args, 'targetAddress', 'target'),
        calldataHash: stringArg(event.args, 'dataHash'),
        functionSelector: receipt?.actionSelector,
        value: receipt?.value,
        sourceDisclosure: sourceDisclosure(
          ExternalSourceLabel.OnchainTransaction,
          ExternalAuthorityClaim.ContractAuthoritative,
          'ProposalExecuted is contract-derived lifecycle state from the governance protocol. Action metadata is generic proposal execution metadata; target contracts are not decoded or treated as governance authority.',
        ),
      },
    );
  }

  private async proposalCancelled(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const orgId = stringArg(event.args, 'orgId');
    const proposalId = stringArg(event.args, 'proposalId');
    await client.query(
      `update proposals set status = $4, updated_at = now() where chain_id = $1 and org_id = $2 and proposal_id = $3`,
      [event.chain_id, orgId, proposalId, ProposalStatus.Cancelled],
    );
    await this.upsertAccountabilityRecord(
      client,
      event,
      orgId,
      proposalId,
      AccountabilityExecutionStatus.Cancelled,
      {
        linkedTxHash: event.tx_hash,
        linkedObservedStatus: ObservedTransactionStatus.Confirmed,
        sourceDisclosure: sourceDisclosure(
          ExternalSourceLabel.ContractState,
          ExternalAuthorityClaim.ContractAuthoritative,
          'ProposalCancelled is contract-derived lifecycle state from the governance protocol.',
        ),
      },
    );
  }

  private async upsertAccountabilityRecord(
    client: PoolClient,
    event: RawEventRow,
    orgId: string,
    proposalId: string,
    executionStatus: AccountabilityExecutionStatus,
    options: {
      readonly linkedTxHash?: string;
      readonly linkedObservedStatus?: ObservedTransactionStatus;
      readonly targetAddress?: string;
      readonly functionSelector?: string;
      readonly calldataHash?: string;
      readonly value?: string;
      readonly failureOrCancellationReason?: string;
      readonly sourceDisclosure?: Record<string, unknown>;
    },
  ): Promise<void> {
    const id = accountabilityRecordId(event.chain_id, orgId, proposalId);
    const decisionRecordId = decisionRecordIdFor(
      event.chain_id,
      orgId,
      proposalId,
    );
    await client.query(
      `
        insert into accountability_records (
          chain_id,
          org_id,
          proposal_id,
          id,
          decision_record_id,
          execution_status,
          linked_tx_hash,
          linked_chain_id,
          linked_tx_observed_status,
          target_address,
          function_selector,
          calldata_hash,
          value,
          failure_or_cancellation_reason,
          source_disclosure,
          data_status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, lower($10), $11, $12, $13, $14, $15::jsonb, $16)
        on conflict (chain_id, org_id, proposal_id) do update set
          id = excluded.id,
          decision_record_id = excluded.decision_record_id,
          execution_status = excluded.execution_status,
          linked_tx_hash = coalesce(excluded.linked_tx_hash, accountability_records.linked_tx_hash),
          linked_chain_id = coalesce(excluded.linked_chain_id, accountability_records.linked_chain_id),
          linked_tx_observed_status = coalesce(excluded.linked_tx_observed_status, accountability_records.linked_tx_observed_status),
          target_address = coalesce(excluded.target_address, accountability_records.target_address),
          function_selector = coalesce(excluded.function_selector, accountability_records.function_selector),
          calldata_hash = coalesce(excluded.calldata_hash, accountability_records.calldata_hash),
          value = coalesce(excluded.value, accountability_records.value),
          failure_or_cancellation_reason = coalesce(excluded.failure_or_cancellation_reason, accountability_records.failure_or_cancellation_reason),
          source_disclosure = coalesce(excluded.source_disclosure, accountability_records.source_disclosure),
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [
        event.chain_id,
        orgId,
        proposalId,
        id,
        decisionRecordId,
        executionStatus,
        options.linkedTxHash,
        options.linkedTxHash ? event.chain_id : undefined,
        options.linkedObservedStatus,
        options.targetAddress,
        options.functionSelector,
        options.calldataHash,
        options.value,
        options.failureOrCancellationReason,
        JSON.stringify(options.sourceDisclosure ?? null),
        event.status,
      ],
    );
  }

  private async proposalStatusChanged(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `update proposals set status = $4, updated_at = now() where chain_id = $1 and org_id = $2 and proposal_id = $3`,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'proposalId'),
        toProposalStatus(arg(event.args, 'newStatus')),
      ],
    );
  }
}

function fallbackName(prefix: string, id: string, hint?: string): string {
  if (hint && !hint.startsWith('ipfs://')) {
    return hint;
  }
  return `${prefix} #${id}`;
}

async function upsertEdge(
  client: PoolClient,
  event: RawEventRow,
  orgId: string,
  sourceType: GraphNodeType,
  sourceId: string,
  targetType: GraphNodeType,
  targetId: string,
  edgeType: GraphEdgeType,
  label: string | undefined,
): Promise<void> {
  await client.query(
    `
      insert into governance_edges (
        chain_id, org_id, source_type, source_id, target_type, target_id,
        edge_type, label, metadata, data_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, $9)
      on conflict (chain_id, org_id, source_type, source_id, target_type, target_id, edge_type)
      do update set label = excluded.label, data_status = excluded.data_status, updated_at = now()
    `,
    [
      event.chain_id,
      orgId,
      sourceType,
      sourceId,
      targetType,
      targetId,
      edgeType,
      label,
      event.status,
    ],
  );
}

function arg(
  args: Record<string, unknown>,
  key: string,
  legacyKey?: string,
): unknown {
  const value = args[key] ?? (legacyKey ? args[legacyKey] : undefined);
  if (value === undefined || value === null) {
    throw new Error(`Missing event argument: ${key}`);
  }
  return value;
}

function stringArg(
  args: Record<string, unknown>,
  key: string,
  legacyKey?: string,
): string {
  return asString(arg(args, key, legacyKey));
}

function optionalStringArg(
  args: Record<string, unknown>,
  key: string,
  legacyKey?: string,
): string | null {
  const value = args[key] ?? (legacyKey ? args[legacyKey] : undefined);
  return value === undefined || value === null ? null : asString(value);
}

function proposalExecutionReceipt(event: RawEventRow):
  | {
      readonly executorAddress: string;
      readonly targetAddress: string;
      readonly value: string;
      readonly actionSelector: string;
      readonly dataHash: string;
      readonly executionMode: ProposalExecutionMode;
      readonly managedExecutorAddress?: string;
    }
  | undefined {
  const value = optionalStringArg(event.args, 'value');
  const actionSelector = optionalStringArg(event.args, 'actionSelector');
  const managedExecutorAddress = optionalStringArg(
    event.args,
    'managedExecutorAddress',
    'managedExecutor',
  );
  if (!value || !actionSelector || !managedExecutorAddress) {
    return undefined;
  }

  const normalizedManagedExecutor = managedExecutorAddress.toLowerCase();
  const isDirect = isZeroAddress(normalizedManagedExecutor);
  return {
    executorAddress: stringArg(event.args, 'executorAddress', 'executor'),
    targetAddress: stringArg(event.args, 'targetAddress', 'target'),
    value,
    actionSelector: actionSelector.toLowerCase(),
    dataHash: stringArg(event.args, 'dataHash'),
    executionMode: isDirect
      ? ProposalExecutionMode.Direct
      : ProposalExecutionMode.Managed,
    managedExecutorAddress: isDirect ? undefined : normalizedManagedExecutor,
  };
}

function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === '0x0000000000000000000000000000000000000000';
}

function accountabilityRecordId(
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

function sourceDisclosure(
  sourceLabel: ExternalSourceLabel,
  authorityClaim: ExternalAuthorityClaim,
  note: string,
): Record<string, unknown> {
  return {
    sourceCategory: GovernanceRecordSourceCategory.ContractReadModel,
    sourceLabel,
    trustBoundary: ExternalTrustBoundary.OnchainObservation,
    authorityClaim,
    note,
  };
}
