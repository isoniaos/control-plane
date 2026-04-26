import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { asString, asStringArray } from '../chain/json';
import {
  toBodyKind,
  toOrganizationStatus,
  toProposalStatus,
  toProposalType,
  toRoleType,
} from '../chain/governance-events';
import { DatabaseService } from '../database/database.service';
import {
  DataStatus,
  DecisionType,
  GovernanceEventName,
  GraphEdgeType,
  GraphNodeType,
  OrganizationStatus,
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

@Injectable()
export class ProjectionService {
  private readonly logger = new Logger(ProjectionService.name);

  constructor(private readonly db: DatabaseService) {}

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

  private async processNextEvent(): Promise<boolean> {
    let selectedEvent: RawEventRow | undefined;
    try {
      return await this.db.transaction(async (client) => {
        const result = await client.query<RawEventRow>(
          `
            select *
            from raw_events
            where status = 'confirmed' and processed_at is null
            order by block_number asc, log_index asc
            limit 1
            for update skip locked
          `,
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
          created_block, created_tx_hash, data_status
        )
        values ($1, $2, lower($3), $4, $5, $6, $7, $8, $9, $10)
        on conflict (chain_id, org_id) do update set
          admin_address = excluded.admin_address,
          slug = excluded.slug,
          name = excluded.name,
          metadata_uri = excluded.metadata_uri,
          status = excluded.status,
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
        event.block_number,
        event.tx_hash,
        event.status,
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

  private async proposalCreated(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    const proposalId = stringArg(event.args, 'proposalId');
    const orgId = stringArg(event.args, 'orgId');
    const proposalType = toProposalType(arg(event.args, 'proposalType'));
    const metadataUri = stringArg(event.args, 'metadataUri', 'metadataURI');
    const policy = await client.query(
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
    const requiredApprovalBodies = (policy.rows[0]?.required_approval_bodies ??
      []) as unknown[];
    const initialStatus =
      requiredApprovalBodies.length === 0
        ? ProposalStatus.Approved
        : ProposalStatus.UnderReview;
    await client.query(
      `
        insert into proposals (
          chain_id, proposal_id, org_id, proposal_type, policy_version, title,
          target_address, value, data_hash, creator_address, status, created_block,
          created_tx_hash, created_at_chain, metadata_uri, data_status
        )
        values ($1, $2, $3, $4, $5, $6, lower($7), $8, $9, lower($10), $11, $12, $13, $14, $15, $16)
        on conflict (chain_id, org_id, proposal_id) do update set
          proposal_type = excluded.proposal_type,
          policy_version = excluded.policy_version,
          title = excluded.title,
          target_address = excluded.target_address,
          value = excluded.value,
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
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'proposalId'),
        ProposalStatus.Executed,
        event.block_timestamp ?? '0',
      ],
    );
  }

  private async proposalCancelled(
    client: PoolClient,
    event: RawEventRow,
  ): Promise<void> {
    await client.query(
      `update proposals set status = $4, updated_at = now() where chain_id = $1 and org_id = $2 and proposal_id = $3`,
      [
        event.chain_id,
        stringArg(event.args, 'orgId'),
        stringArg(event.args, 'proposalId'),
        ProposalStatus.Cancelled,
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
