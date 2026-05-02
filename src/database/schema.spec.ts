import { CONTROL_PLANE_SCHEMA_SQL } from './schema';

describe('CONTROL_PLANE_SCHEMA_SQL', () => {
  const sql = CONTROL_PLANE_SCHEMA_SQL.replace(/\s+/g, ' ').toLowerCase();

  it('uses org-scoped primary keys for org-owned read models', () => {
    expect(sql).toContain('primary key(chain_id, org_id, body_id)');
    expect(sql).toContain('primary key(chain_id, org_id, role_id)');
    expect(sql).toContain('primary key(chain_id, org_id, mandate_id)');
    expect(sql).toContain('primary key(chain_id, org_id, proposal_id)');
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

  it('stores runtime heartbeats by chain and process', () => {
    expect(sql).toContain('create table if not exists runtime_heartbeats');
    expect(sql).toContain('primary key(chain_id, process_name)');
  });
});
