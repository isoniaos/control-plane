export const CONTROL_PLANE_SCHEMA_SQL = `
create table if not exists raw_events (
  id bigserial primary key,
  chain_id bigint not null,
  contract_address text not null,
  block_number bigint not null,
  block_hash text not null,
  block_timestamp numeric,
  tx_hash text not null,
  log_index integer not null,
  event_name text not null,
  args jsonb not null,
  raw_log jsonb not null,
  status text not null default 'confirmed',
  confirmations integer not null default 0,
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  error text,
  processing_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(chain_id, tx_hash, log_index)
);

create table if not exists chain_cursors (
  chain_id bigint not null,
  contract_address text not null,
  last_scanned_block bigint not null,
  last_confirmed_block bigint,
  updated_at timestamptz not null default now(),
  primary key(chain_id, contract_address)
);

create table if not exists organizations (
  chain_id bigint not null,
  org_id bigint not null,
  admin_address text not null,
  slug text not null,
  name text not null,
  metadata_uri text,
  status text not null,
  created_block bigint not null,
  created_tx_hash text not null,
  data_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(chain_id, org_id)
);

create table if not exists bodies (
  chain_id bigint not null,
  body_id bigint not null,
  org_id bigint not null,
  kind text not null,
  name text not null,
  metadata_uri text,
  active boolean not null,
  created_block bigint not null,
  data_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(chain_id, org_id, body_id)
);

create table if not exists roles (
  chain_id bigint not null,
  role_id bigint not null,
  org_id bigint not null,
  body_id bigint not null,
  role_type text not null,
  name text not null,
  metadata_uri text,
  active boolean not null,
  data_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(chain_id, org_id, role_id)
);

create table if not exists mandates (
  chain_id bigint not null,
  mandate_id bigint not null,
  org_id bigint not null,
  body_id bigint not null,
  role_id bigint not null,
  holder_address text not null,
  start_time numeric not null,
  end_time numeric not null,
  proposal_type_mask numeric not null,
  spending_limit numeric not null,
  active boolean not null,
  revoked boolean not null,
  data_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(chain_id, org_id, mandate_id)
);

create table if not exists policy_rules (
  chain_id bigint not null,
  org_id bigint not null,
  proposal_type text not null,
  version bigint not null,
  required_approval_bodies jsonb not null,
  veto_bodies jsonb not null,
  executor_body bigint,
  timelock_seconds numeric not null,
  enabled boolean not null,
  data_status text not null,
  updated_at timestamptz not null default now(),
  primary key(chain_id, org_id, proposal_type, version)
);

create table if not exists current_policy_rules (
  chain_id bigint not null,
  org_id bigint not null,
  proposal_type text not null,
  version bigint not null,
  required_approval_bodies jsonb not null,
  veto_bodies jsonb not null,
  executor_body bigint,
  timelock_seconds numeric not null,
  enabled boolean not null,
  data_status text not null,
  updated_at timestamptz not null default now(),
  primary key(chain_id, org_id, proposal_type)
);

create table if not exists proposals (
  chain_id bigint not null,
  proposal_id bigint not null,
  org_id bigint not null,
  proposal_type text not null,
  policy_version bigint not null,
  title text not null,
  description_uri text,
  target_address text,
  value numeric not null,
  data_hash text,
  creator_address text not null,
  status text not null,
  created_block bigint not null,
  created_tx_hash text not null,
  created_at_chain numeric not null,
  queued_at_chain numeric,
  executable_at_chain numeric,
  executed_at_chain numeric,
  metadata_uri text,
  data_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(chain_id, org_id, proposal_id)
);

create table if not exists proposal_decisions (
  id bigserial primary key,
  chain_id bigint not null,
  org_id bigint not null,
  proposal_id bigint not null,
  body_id bigint not null,
  actor_address text not null,
  decision_type text not null,
  tx_hash text not null,
  block_number bigint not null,
  log_index integer not null,
  decided_at_chain numeric not null,
  data_status text not null,
  created_at timestamptz not null default now(),
  constraint proposal_decisions_identity_key unique(chain_id, org_id, proposal_id, body_id, decision_type)
);

create table if not exists governance_edges (
  id bigserial primary key,
  chain_id bigint not null,
  org_id bigint not null,
  source_type text not null,
  source_id text not null,
  target_type text not null,
  target_id text not null,
  edge_type text not null,
  label text,
  metadata jsonb not null default '{}',
  data_status text not null,
  updated_at timestamptz not null default now(),
  unique(chain_id, org_id, source_type, source_id, target_type, target_id, edge_type)
);

create index if not exists raw_events_unprocessed_idx
  on raw_events(chain_id, block_number, log_index)
  where processed_at is null and status = 'confirmed';

create index if not exists proposals_org_idx on proposals(chain_id, org_id, proposal_id);
create index if not exists bodies_org_idx on bodies(chain_id, org_id);
create index if not exists roles_org_idx on roles(chain_id, org_id);
create index if not exists mandates_org_idx on mandates(chain_id, org_id);

alter table bodies drop constraint if exists bodies_pkey;
alter table bodies add primary key (chain_id, org_id, body_id);

alter table roles drop constraint if exists roles_pkey;
alter table roles add primary key (chain_id, org_id, role_id);

alter table mandates drop constraint if exists mandates_pkey;
alter table mandates add primary key (chain_id, org_id, mandate_id);

alter table proposals drop constraint if exists proposals_pkey;
alter table proposals add primary key (chain_id, org_id, proposal_id);

alter table proposal_decisions drop constraint if exists proposal_decisions_chain_id_proposal_id_body_id_decision_type_key;
alter table proposal_decisions drop constraint if exists proposal_decisions_chain_id_proposal_id_body_id_decision_type_k;
alter table proposal_decisions drop constraint if exists proposal_decisions_identity_key;
alter table proposal_decisions add constraint proposal_decisions_identity_key unique(chain_id, org_id, proposal_id, body_id, decision_type);
`;
