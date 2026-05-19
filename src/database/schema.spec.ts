import { CONTROL_PLANE_SCHEMA_SQL } from './schema';

describe('CONTROL_PLANE_SCHEMA_SQL', () => {
  const sql = CONTROL_PLANE_SCHEMA_SQL.replace(/\s+/g, ' ').toLowerCase();

  it('uses org-scoped primary keys for org-owned read models', () => {
    expect(sql).toContain('primary key(chain_id, org_id, body_id)');
    expect(sql).toContain('primary key(chain_id, org_id, role_id)');
    expect(sql).toContain('primary key(chain_id, org_id, mandate_id)');
    expect(sql).toContain('primary key(chain_id, org_id, proposal_id)');
  });

  it('stores nullable proposal action selectors for selector-aware identity', () => {
    expect(sql).toContain('action_selector text');
    expect(sql).toContain(
      'alter table proposals add column if not exists action_selector text',
    );
  });

  it('uses an org-scoped proposal decision identity', () => {
    expect(sql).toContain(
      'constraint proposal_decisions_identity_key unique(chain_id, org_id, proposal_id, body_id, decision_type)',
    );
    expect(sql).toContain(
      'alter table proposal_decisions add constraint proposal_decisions_identity_key unique(chain_id, org_id, proposal_id, body_id, decision_type)',
    );
    expect(sql).toContain(
      'drop constraint if exists proposal_decisions_chain_id_proposal_id_body_id_decision_type_k',
    );
  });

  it('uses contract-scoped raw event identity', () => {
    expect(sql).toContain(
      'constraint raw_events_identity_key unique(chain_id, contract_address, tx_hash, log_index)',
    );
    expect(sql).toContain(
      'alter table raw_events add constraint raw_events_identity_key unique(chain_id, contract_address, tx_hash, log_index)',
    );
    expect(sql).toContain(
      'alter table raw_events drop constraint if exists raw_events_chain_id_tx_hash_log_index_key',
    );
  });

  it('stores runtime heartbeats by chain and process', () => {
    expect(sql).toContain('create table if not exists runtime_heartbeats');
    expect(sql).toContain('primary key(chain_id, process_name)');
  });

  it('stores organization finalization read-model metadata', () => {
    expect(sql).toContain(
      "finalization_status text not null default 'unknown'",
    );
    expect(sql).toContain('finalized_admin_address text');
    expect(sql).toContain('finalized_block bigint');
    expect(sql).toContain('finalized_tx_hash text');
    expect(sql).toContain('finalized_at_chain numeric');
    expect(sql).toContain(
      'alter table organizations add column if not exists finalization_status',
    );
  });

  it('adds v0.8 accountability and external resource read models', () => {
    expect(sql).toContain('create table if not exists accountability_records');
    expect(sql).toContain('primary key(chain_id, org_id, id)');
    expect(sql).toContain('unique(chain_id, org_id, proposal_id)');
    expect(sql).toContain('linked_tx_hash text');
    expect(sql).toContain('target_address text');
    expect(sql).toContain('function_selector text');
    expect(sql).toContain('calldata_hash text');
    expect(sql).toContain('value numeric');
    expect(sql).toContain('source_disclosure jsonb');
    expect(sql).toContain('create table if not exists external_resources');
    expect(sql).toContain('authority_claim text not null');
    expect(sql).toContain(
      'create index if not exists external_resources_proposal_idx',
    );
  });

  it('adds v0.8 execution permission registry read models', () => {
    expect(sql).toContain('create table if not exists execution_target_rules');
    expect(sql).toContain('primary key(chain_id, org_id, target_address)');
    expect(sql).toContain('max_value numeric not null');
    expect(sql).toContain('updated_at_block_number bigint not null');
    expect(sql).toContain(
      'create table if not exists execution_selector_rules',
    );
    expect(sql).toContain(
      'primary key(chain_id, org_id, target_address, selector)',
    );
    expect(sql).toContain(
      'create index if not exists execution_selector_rules_target_idx',
    );
  });

  it('adds v0.8 managed execution read models', () => {
    expect(sql).toContain('create table if not exists org_executors');
    expect(sql).toContain('executor_address text');
    expect(sql).toContain('previous_executor_address text');
    expect(sql).toContain('updated_by_address text');
    expect(sql).toContain('raw_event_id bigint');
    expect(sql).toContain(
      'create table if not exists proposal_execution_receipts',
    );
    expect(sql).toContain('primary key(chain_id, org_id, proposal_id)');
    expect(sql).toContain('execution_mode text not null');
    expect(sql).toContain('managed_executor_address text');
    expect(sql).toContain(
      'create index if not exists proposal_execution_receipts_org_idx',
    );
  });
});
