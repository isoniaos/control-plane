import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';

export type RuntimeProcessName = 'api' | 'indexer' | 'projections';

export type RuntimeProcessStatus = 'running' | 'stale' | 'unknown';

export interface RuntimeProcessHeartbeatDto {
  readonly processName: RuntimeProcessName;
  readonly status: RuntimeProcessStatus;
  readonly lastSeenAt?: string;
  readonly ageMs?: number;
  readonly metadata: Record<string, unknown>;
}

interface RuntimeHeartbeatRow {
  readonly process_name: RuntimeProcessName;
  readonly last_seen_at: Date | string;
  readonly metadata: Record<string, unknown> | string | null;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const MIN_STALE_AFTER_MS = 30_000;

@Injectable()
export class RuntimeHeartbeatService implements OnModuleDestroy {
  private readonly logger = new Logger(RuntimeHeartbeatService.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly config: AppConfigService,
    private readonly db: DatabaseService,
  ) {}

  get staleAfterMs(): number {
    return Math.max(this.config.pollIntervalMs * 3, MIN_STALE_AFTER_MS);
  }

  start(
    processName: RuntimeProcessName,
    metadataFactory: () =>
      | Record<string, unknown>
      | Promise<Record<string, unknown>>,
  ): NodeJS.Timeout {
    const writeHeartbeat = async (): Promise<void> => {
      try {
        await this.record(processName, await metadataFactory());
      } catch (error) {
        this.logger.warn(
          `Failed to record ${processName} heartbeat: ${formatError(error)}`,
        );
      }
    };

    void writeHeartbeat();
    const timer = setInterval(
      () => void writeHeartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );
    this.timers.push(timer);
    return timer;
  }

  async record(
    processName: RuntimeProcessName,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `
        insert into runtime_heartbeats (chain_id, process_name, last_seen_at, metadata)
        values ($1, $2, now(), $3::jsonb)
        on conflict (chain_id, process_name) do update set
          last_seen_at = excluded.last_seen_at,
          metadata = excluded.metadata
      `,
      [this.config.chainId, processName, JSON.stringify(metadata)],
    );
  }

  async getProcesses(
    processNames: readonly RuntimeProcessName[],
  ): Promise<RuntimeProcessHeartbeatDto[]> {
    const result = await this.db.query<RuntimeHeartbeatRow>(
      `
        select process_name, last_seen_at, metadata
        from runtime_heartbeats
        where chain_id = $1 and process_name = any($2)
      `,
      [this.config.chainId, processNames],
    );
    const rowsByProcess = new Map(
      result.rows.map((row) => [row.process_name, row]),
    );
    const now = Date.now();

    return processNames.map((processName) => {
      const row = rowsByProcess.get(processName);
      if (!row) {
        return {
          processName,
          status: 'unknown',
          metadata: {},
        };
      }

      const lastSeenAt = toDate(row.last_seen_at);
      const ageMs = Math.max(0, now - lastSeenAt.getTime());
      return {
        processName,
        status: ageMs <= this.staleAfterMs ? 'running' : 'stale',
        lastSeenAt: lastSeenAt.toISOString(),
        ageMs,
        metadata: parseMetadata(row.metadata),
      };
    });
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
  }
}

function parseMetadata(
  value: Record<string, unknown> | string | null,
): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return value ?? {};
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
