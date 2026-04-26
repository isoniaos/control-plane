import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { asString, asStringArray } from '../chain/json';
import {
  BODY_KIND_BY_CHAIN_VALUE,
  ORGANIZATION_STATUS_BY_CHAIN_VALUE,
  PROPOSAL_STATUS_BY_CHAIN_VALUE,
  PROPOSAL_TYPE_BY_CHAIN_VALUE,
  ROLE_TYPE_BY_CHAIN_VALUE,
} from '../chain/domain-maps';
import { DatabaseService } from '../database/database.service';

interface RawEventRow {
  readonly id: string;
  readonly chain_id: string;
  readonly block_number: string;
  readonly tx_hash: string;
  readonly log_index: number;
  readonly event_name: string;
  readonly args: Record<string, unknown>;
  readonly status: string;
  readonly block_timestamp: string | null;
}

@Injectable()
export class ProjectionService {
  private readonly logger = new Logger(ProjectionService.name);

  constructor(private readonly db: DatabaseService) {}

  async processBatch(limit = 100): Promise<number> {
    const result = await this.db.query<RawEventRow>(
      `
        select *
        from raw_events
        where status = 'confirmed' and processed_at is null
        order by block_number asc, log_index asc
        limit $1
      `,
      [limit],
    );

    for (const event of result.rows) {
      await this.processEvent(event);
    }

    if (result.rowCount) {
      this.logger.log(`Projected ${result.rowCount} raw events`);
    }
    return result.rowCount ?? 0;
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

  private async processEvent(event: RawEventRow): Promise<void> {
    await this.db.transaction(async (client) => {
      try {
        await this.applyEvent(client, event);
        await client.query(
          `update raw_events set processed_at = now(), failed_at = null, error = null, updated_at = now() where id = $1`,
          [event.id],
        );
      } catch (error) {
        await client.query(
          `
            update raw_events
            set failed_at = now(),
                error = $2,
                processing_attempts = processing_attempts + 1,
                updated_at = now()
            where id = $1
          `,
          [event.id, error instanceof Error ? error.message : String(error)],
        );
        throw error;
      }
    });
  }

  private async applyEvent(client: PoolClient, event: RawEventRow): Promise<void> {
    switch (event.event_name) {
      case 'OrganizationCreated':
        return this.organizationCreated(client, event);
      case 'OrganizationUpdated':
        return this.organizationUpdated(client, event);
      case 'OrganizationStatusChanged':
        return this.organizationStatusChanged(client, event);
      case 'BodyCreated':
        return this.bodyCreated(client, event);
      case 'BodyUpdated':
        return this.bodyUpdated(client, event);
      case 'RoleCreated':
        return this.roleCreated(client, event);
      case 'RoleUpdated':
        return this.roleUpdated(client, event);
      case 'MandateAssigned':
        return this.mandateAssigned(client, event);
      case 'MandateRevoked':
        return this.mandateRevoked(client, event);
      case 'PolicyRuleSet':
        return this.policyRuleSet(client, event);
      case 'ProposalCreated':
        return this.proposalCreated(client, event);
      case 'ProposalApproved':
        return this.proposalDecision(client, event, 'approve');
      case 'ProposalVetoed':
        return this.proposalDecision(client, event, 'veto');
      case 'ProposalQueued':
        return this.proposalQueued(client, event);
      case 'ProposalExecuted':
        return this.proposalExecuted(client, event);
      case 'ProposalCancelled':
        return this.proposalCancelled(client, event);
      case 'ProposalStatusChanged':
        return this.proposalStatusChanged(client, event);
      default:
        return undefined;
    }
  }

  private async organizationCreated(client: PoolClient, event: RawEventRow): Promise<void> {
    const args = event.args;
    const orgId = asString(args.orgId);
    const slug = asString(args.slug);
    await client.query(
      `
        insert into organizations (
          chain_id, org_id, admin_address, slug, name, metadata_uri, status,
          created_block, created_tx_hash, data_status
        )
        values ($1, $2, lower($3), $4, $5, $6, 'active', $7, $8, $9)
        on conflict (chain_id, org_id) do update set
          admin_address = excluded.admin_address,
          slug = excluded.slug,
          name = excluded.name,
          metadata_uri = excluded.metadata_uri,
          status = excluded.status,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [event.chain_id, orgId, args.admin, slug, fallbackName('Organization', orgId, slug), args.metadataURI, event.block_number, event.tx_hash, event.status],
    );
  }

  private async organizationUpdated(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `update organizations set metadata_uri = $3, updated_at = now() where chain_id = $1 and org_id = $2`,
      [event.chain_id, asString(event.args.orgId), event.args.metadataURI],
    );
  }

  private async organizationStatusChanged(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `update organizations set status = $3, updated_at = now() where chain_id = $1 and org_id = $2`,
      [event.chain_id, asString(event.args.orgId), mapValue(ORGANIZATION_STATUS_BY_CHAIN_VALUE, event.args.status, 'unknown')],
    );
  }

  private async bodyCreated(client: PoolClient, event: RawEventRow): Promise<void> {
    const bodyId = asString(event.args.bodyId);
    const orgId = asString(event.args.orgId);
    await client.query(
      `
        insert into bodies (chain_id, body_id, org_id, kind, name, metadata_uri, active, created_block, data_status)
        values ($1, $2, $3, $4, $5, $6, true, $7, $8)
        on conflict (chain_id, body_id) do update set
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
        mapValue(BODY_KIND_BY_CHAIN_VALUE, event.args.kind, 'custom'),
        fallbackName('Body', bodyId),
        event.args.metadataURI,
        event.block_number,
        event.status,
      ],
    );
    await upsertEdge(client, event, orgId, 'organization', orgId, 'body', bodyId, 'contains', undefined);
  }

  private async bodyUpdated(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `update bodies set active = $4, metadata_uri = $5, updated_at = now() where chain_id = $1 and org_id = $2 and body_id = $3`,
      [event.chain_id, asString(event.args.orgId), asString(event.args.bodyId), event.args.active, event.args.metadataURI],
    );
  }

  private async roleCreated(client: PoolClient, event: RawEventRow): Promise<void> {
    const roleId = asString(event.args.roleId);
    const orgId = asString(event.args.orgId);
    const bodyId = asString(event.args.bodyId);
    const roleType = mapValue(ROLE_TYPE_BY_CHAIN_VALUE, event.args.roleType, 'unknown');
    await client.query(
      `
        insert into roles (chain_id, role_id, org_id, body_id, role_type, name, metadata_uri, active, data_status)
        values ($1, $2, $3, $4, $5, $6, $7, true, $8)
        on conflict (chain_id, role_id) do update set
          org_id = excluded.org_id,
          body_id = excluded.body_id,
          role_type = excluded.role_type,
          name = excluded.name,
          metadata_uri = excluded.metadata_uri,
          active = excluded.active,
          data_status = excluded.data_status,
          updated_at = now()
      `,
      [event.chain_id, roleId, orgId, bodyId, roleType, fallbackName('Role', roleId, roleType), event.args.metadataURI, event.status],
    );
    await upsertEdge(client, event, orgId, 'body', bodyId, 'role', roleId, 'contains', roleType);
  }

  private async roleUpdated(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `update roles set active = $4, metadata_uri = $5, updated_at = now() where chain_id = $1 and org_id = $2 and role_id = $3`,
      [event.chain_id, asString(event.args.orgId), asString(event.args.roleId), event.args.active, event.args.metadataURI],
    );
  }

  private async mandateAssigned(client: PoolClient, event: RawEventRow): Promise<void> {
    const mandateId = asString(event.args.mandateId);
    const orgId = asString(event.args.orgId);
    const roleId = asString(event.args.roleId);
    const bodyId = asString(event.args.bodyId);
    const holder = String(event.args.holder).toLowerCase();
    await client.query(
      `
        insert into mandates (
          chain_id, mandate_id, org_id, body_id, role_id, holder_address, start_time,
          end_time, proposal_type_mask, spending_limit, active, revoked, data_status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false, $11)
        on conflict (chain_id, mandate_id) do update set
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
        asString(event.args.startTime),
        asString(event.args.endTime),
        asString(event.args.proposalTypeMask),
        asString(event.args.spendingLimit),
        event.status,
      ],
    );
    await upsertEdge(client, event, orgId, 'holder', holder, 'role', roleId, 'holds', undefined);
  }

  private async mandateRevoked(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `update mandates set active = false, revoked = true, updated_at = now() where chain_id = $1 and org_id = $2 and mandate_id = $3`,
      [event.chain_id, asString(event.args.orgId), asString(event.args.mandateId)],
    );
  }

  private async policyRuleSet(client: PoolClient, event: RawEventRow): Promise<void> {
    const orgId = asString(event.args.orgId);
    const proposalType = mapValue(PROPOSAL_TYPE_BY_CHAIN_VALUE, event.args.proposalType, 'unknown');
    const version = asString(event.args.version);
    const requiredApprovalBodies = asStringArray(event.args.requiredApprovalBodies);
    const vetoBodies = asStringArray(event.args.vetoBodies);
    const executorBody = asString(event.args.executorBody);
    const params = [
      event.chain_id,
      orgId,
      proposalType,
      version,
      JSON.stringify(requiredApprovalBodies),
      JSON.stringify(vetoBodies),
      executorBody === '0' ? null : executorBody,
      asString(event.args.timelockSeconds),
      Boolean(event.args.enabled),
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
      await upsertEdge(client, event, orgId, 'proposal_type', proposalType, 'body', bodyId, 'requires_approval', undefined);
    }
    for (const bodyId of vetoBodies) {
      await upsertEdge(client, event, orgId, 'proposal_type', proposalType, 'body', bodyId, 'can_veto', undefined);
    }
    if (executorBody !== '0') {
      await upsertEdge(client, event, orgId, 'proposal_type', proposalType, 'body', executorBody, 'can_execute', undefined);
    }
  }

  private async proposalCreated(client: PoolClient, event: RawEventRow): Promise<void> {
    const proposalId = asString(event.args.proposalId);
    const orgId = asString(event.args.orgId);
    const proposalType = mapValue(PROPOSAL_TYPE_BY_CHAIN_VALUE, event.args.proposalType, 'unknown');
    const metadataUri = asString(event.args.metadataURI);
    const policy = await client.query(
      `
        select required_approval_bodies
        from policy_rules
        where chain_id = $1 and org_id = $2 and proposal_type = $3 and version = $4
      `,
      [event.chain_id, orgId, proposalType, asString(event.args.policyVersion)],
    );
    const requiredApprovalBodies = (policy.rows[0]?.required_approval_bodies ?? []) as unknown[];
    const initialStatus = requiredApprovalBodies.length === 0 ? 'approved' : 'under_review';
    await client.query(
      `
        insert into proposals (
          chain_id, proposal_id, org_id, proposal_type, policy_version, title,
          target_address, value, data_hash, creator_address, status, created_block,
          created_tx_hash, created_at_chain, metadata_uri, data_status
        )
        values ($1, $2, $3, $4, $5, $6, lower($7), $8, $9, lower($10), $11, $12, $13, $14, $15, $16)
        on conflict (chain_id, proposal_id) do update set
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
        asString(event.args.policyVersion),
        fallbackName('Proposal', proposalId, metadataUri),
        event.args.target,
        asString(event.args.value),
        event.args.dataHash,
        event.args.creator,
        initialStatus,
        event.block_number,
        event.tx_hash,
        event.block_timestamp ?? '0',
        metadataUri,
        event.status,
      ],
    );
    await upsertEdge(client, event, orgId, 'proposal', proposalId, 'proposal_type', proposalType, 'contains', undefined);
  }

  private async proposalDecision(client: PoolClient, event: RawEventRow, decisionType: 'approve' | 'veto'): Promise<void> {
    await client.query(
      `
        insert into proposal_decisions (
          chain_id, org_id, proposal_id, body_id, actor_address, decision_type,
          tx_hash, block_number, log_index, decided_at_chain, data_status
        )
        values ($1, $2, $3, $4, lower($5), $6, $7, $8, $9, $10, $11)
        on conflict (chain_id, proposal_id, body_id, decision_type) do update set
          actor_address = excluded.actor_address,
          tx_hash = excluded.tx_hash,
          block_number = excluded.block_number,
          log_index = excluded.log_index,
          decided_at_chain = excluded.decided_at_chain,
          data_status = excluded.data_status
      `,
      [
        event.chain_id,
        asString(event.args.orgId),
        asString(event.args.proposalId),
        asString(event.args.bodyId),
        event.args.actor,
        decisionType,
        event.tx_hash,
        event.block_number,
        event.log_index,
        event.block_timestamp ?? '0',
        event.status,
      ],
    );
  }

  private async proposalQueued(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `
        update proposals
        set status = 'queued',
            queued_at_chain = $4,
            executable_at_chain = $5,
            updated_at = now()
        where chain_id = $1 and org_id = $2 and proposal_id = $3
      `,
      [event.chain_id, asString(event.args.orgId), asString(event.args.proposalId), asString(event.args.queuedAt), asString(event.args.executableAt)],
    );
  }

  private async proposalExecuted(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `
        update proposals
        set status = 'executed',
            executed_at_chain = $4,
            updated_at = now()
        where chain_id = $1 and org_id = $2 and proposal_id = $3
      `,
      [event.chain_id, asString(event.args.orgId), asString(event.args.proposalId), event.block_timestamp ?? '0'],
    );
  }

  private async proposalCancelled(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `update proposals set status = 'cancelled', updated_at = now() where chain_id = $1 and org_id = $2 and proposal_id = $3`,
      [event.chain_id, asString(event.args.orgId), asString(event.args.proposalId)],
    );
  }

  private async proposalStatusChanged(client: PoolClient, event: RawEventRow): Promise<void> {
    await client.query(
      `update proposals set status = $4, updated_at = now() where chain_id = $1 and org_id = $2 and proposal_id = $3`,
      [
        event.chain_id,
        asString(event.args.orgId),
        asString(event.args.proposalId),
        mapValue(PROPOSAL_STATUS_BY_CHAIN_VALUE, event.args.newStatus, 'unknown'),
      ],
    );
  }
}

function mapValue(map: Record<string, string>, value: unknown, fallback: string): string {
  return map[asString(value)] ?? fallback;
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
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string,
  edgeType: string,
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
    [event.chain_id, orgId, sourceType, sourceId, targetType, targetId, edgeType, label, event.status],
  );
}
