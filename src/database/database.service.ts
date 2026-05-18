import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CONTROL_PLANE_SCHEMA_SQL } from './schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: AppConfigService) {
    this.pool = new Pool({ connectionString: config.databaseUrl });
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  migrate(): Promise<QueryResult> {
    return this.pool.query(CONTROL_PLANE_SCHEMA_SQL);
  }

  async resetReadModels(): Promise<void> {
    await this.pool.query(`
      truncate table
        organizations,
        bodies,
        roles,
        mandates,
        policy_rules,
        current_policy_rules,
        execution_target_rules,
        execution_selector_rules,
        proposals,
        proposal_decisions,
        accountability_records,
        external_resources,
        governance_edges
      restart identity cascade;

      update raw_events
      set processed_at = null,
          failed_at = null,
          error = null,
          processing_attempts = 0,
          updated_at = now()
      where status = 'confirmed';
    `);
  }

  async resetAll(): Promise<void> {
    await this.pool.query(`
      truncate table
        raw_events,
        chain_cursors,
        runtime_heartbeats,
        organizations,
        bodies,
        roles,
        mandates,
        policy_rules,
        current_policy_rules,
        execution_target_rules,
        execution_selector_rules,
        proposals,
        proposal_decisions,
        accountability_records,
        external_resources,
        governance_edges
      restart identity cascade;
    `);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
