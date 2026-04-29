import { Injectable } from '@nestjs/common';
import type {
  Address,
  DiagnosticsContractCursorDto,
  DiagnosticsContractDto,
  DiagnosticsContractName,
  DiagnosticsDto,
  DiagnosticsProjectionErrorDto,
  DiagnosticsRawEventCountsDto,
  DiagnosticsStaleDataIndicatorDto,
} from '@isonia/types';
import { createPublicClient, http } from 'viem';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';

const CONTROL_PLANE_API_VERSION = 'v1';

interface ChainCursorRow {
  readonly contract_address: string;
  readonly last_scanned_block: string | null;
  readonly last_confirmed_block: string | null;
  readonly updated_at: Date | string | null;
}

interface RawEventCountRow {
  readonly status: keyof DiagnosticsRawEventCountsDto;
  readonly count: number | string;
}

interface ProjectionSummaryRow {
  readonly projectionBacklog: number | string;
  readonly failedProjectionCount: number | string;
}

interface ProjectionErrorRow {
  readonly id: string;
  readonly chain_id: string;
  readonly contract_address: string;
  readonly block_number: string;
  readonly tx_hash: string;
  readonly log_index: number;
  readonly event_name: string;
  readonly error: string | null;
  readonly failed_at: Date | string | null;
  readonly processing_attempts: number | string;
}

@Injectable()
export class DiagnosticsService {
  private readonly client;

  constructor(
    private readonly config: AppConfigService,
    private readonly db: DatabaseService,
  ) {
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  async getDiagnostics(): Promise<DiagnosticsDto> {
    const contracts = this.getConfiguredContracts();
    const latestChainBlock = await this.getLatestChainBlockOrUndefined();
    const latestSafeBlock =
      latestChainBlock === undefined
        ? undefined
        : safeBlock(latestChainBlock, this.config.confirmations);

    const [cursorRows, rawEventCounts, projectionSummary, latestError] =
      await Promise.all([
        this.getCursorRows(contracts),
        this.getRawEventCounts(),
        this.getProjectionSummary(),
        this.getLatestProjectionError(),
      ]);

    const lastScannedBlocks = this.toContractCursors(
      contracts,
      cursorRows,
      latestSafeBlock,
    );
    const indicators = this.buildStaleDataIndicators(
      contracts,
      lastScannedBlocks,
      latestChainBlock,
      latestSafeBlock,
      projectionSummary.projectionBacklog,
      projectionSummary.failedProjectionCount,
    );

    return {
      apiVersion: CONTROL_PLANE_API_VERSION,
      chainId: this.config.chainId,
      confirmations: this.config.confirmations,
      contracts,
      ...(latestChainBlock === undefined
        ? {}
        : { latestChainBlock: latestChainBlock.toString() }),
      ...(latestSafeBlock === undefined
        ? {}
        : { latestSafeBlock: latestSafeBlock.toString() }),
      lastScannedBlocks,
      rawEventCounts,
      projectionBacklog: projectionSummary.projectionBacklog,
      failedProjectionCount: projectionSummary.failedProjectionCount,
      ...(latestError ? { latestProjectionError: latestError } : {}),
      staleDataIndicators: indicators,
      generatedAt: new Date().toISOString(),
    };
  }

  private getConfiguredContracts(): DiagnosticsContractDto[] {
    return [
      toContractDto('govCore', this.config.contracts.govCoreAddress),
      toContractDto(
        'govProposals',
        this.config.contracts.govProposalsAddress,
      ),
    ];
  }

  private async getLatestChainBlockOrUndefined(): Promise<bigint | undefined> {
    try {
      return await this.client.getBlockNumber();
    } catch {
      return undefined;
    }
  }

  private async getCursorRows(
    contracts: readonly DiagnosticsContractDto[],
  ): Promise<ChainCursorRow[]> {
    const addresses = contracts
      .flatMap((contract) => (contract.address ? [contract.address] : []))
      .map((address) => address.toLowerCase());
    if (addresses.length === 0) {
      return [];
    }

    const result = await this.db.query<ChainCursorRow>(
      `
        select contract_address, last_scanned_block, last_confirmed_block, updated_at
        from chain_cursors
        where chain_id = $1 and contract_address = any($2)
      `,
      [this.config.chainId, addresses],
    );
    return result.rows;
  }

  private async getRawEventCounts(): Promise<DiagnosticsRawEventCountsDto> {
    const result = await this.db.query<RawEventCountRow>(
      `
        select status_bucket as status, count(*)::int as count
        from (
          select
            case
              when status = 'orphaned' then 'orphaned'
              when processed_at is not null then 'processed'
              when failed_at is not null or status = 'failed' then 'failed'
              when status = 'observed' then 'observed'
              else 'confirmed'
            end as status_bucket
          from raw_events
          where chain_id = $1
        ) events
        group by status_bucket
      `,
      [this.config.chainId],
    );

    const counts: Record<keyof DiagnosticsRawEventCountsDto, number> = {
      observed: 0,
      confirmed: 0,
      processed: 0,
      failed: 0,
      orphaned: 0,
    };
    for (const row of result.rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  private async getProjectionSummary(): Promise<{
    projectionBacklog: number;
    failedProjectionCount: number;
  }> {
    const result = await this.db.query<ProjectionSummaryRow>(
      `
        select
          count(*) filter (
            where status = 'confirmed' and processed_at is null and failed_at is null
          )::int as "projectionBacklog",
          count(*) filter (
            where processed_at is null
              and status <> 'orphaned'
              and (failed_at is not null or status = 'failed')
          )::int as "failedProjectionCount"
        from raw_events
        where chain_id = $1
      `,
      [this.config.chainId],
    );
    const row = result.rows[0];
    return {
      projectionBacklog: Number(row?.projectionBacklog ?? 0),
      failedProjectionCount: Number(row?.failedProjectionCount ?? 0),
    };
  }

  private async getLatestProjectionError(): Promise<
    DiagnosticsProjectionErrorDto | undefined
  > {
    const result = await this.db.query<ProjectionErrorRow>(
      `
        select
          id,
          chain_id,
          contract_address,
          block_number,
          tx_hash,
          log_index,
          event_name,
          error,
          failed_at,
          processing_attempts
        from raw_events
        where chain_id = $1
          and processed_at is null
          and status <> 'orphaned'
          and (failed_at is not null or error is not null or status = 'failed')
        order by failed_at desc nulls last, updated_at desc
        limit 1
      `,
      [this.config.chainId],
    );
    const row = result.rows[0];
    if (!row || !row.error) {
      return undefined;
    }
    return {
      rawEventId: row.id,
      chainId: Number(row.chain_id),
      contractAddress: row.contract_address as Address,
      blockNumber: row.block_number,
      txHash: row.tx_hash as `0x${string}`,
      logIndex: row.log_index,
      eventName: row.event_name,
      error: row.error,
      ...(row.failed_at ? { failedAt: formatTimestamp(row.failed_at) } : {}),
      processingAttempts: Number(row.processing_attempts),
    };
  }

  private toContractCursors(
    contracts: readonly DiagnosticsContractDto[],
    rows: readonly ChainCursorRow[],
    latestSafeBlock: bigint | undefined,
  ): DiagnosticsContractCursorDto[] {
    const cursorByAddress = new Map(
      rows.map((row) => [row.contract_address.toLowerCase(), row]),
    );

    return contracts.flatMap((contract) => {
      if (!contract.address) {
        return [];
      }
      const row = cursorByAddress.get(contract.address.toLowerCase());
      const lastScannedBlock = row?.last_scanned_block
        ? BigInt(row.last_scanned_block)
        : undefined;
      const lagFromSafeBlock =
        latestSafeBlock !== undefined &&
        lastScannedBlock !== undefined &&
        latestSafeBlock > lastScannedBlock
          ? latestSafeBlock - lastScannedBlock
          : undefined;

      return [
        {
          contractName: contract.name,
          address: contract.address,
          ...(row?.last_scanned_block
            ? { lastScannedBlock: row.last_scanned_block }
            : {}),
          ...(row?.last_confirmed_block
            ? { lastConfirmedBlock: row.last_confirmed_block }
            : {}),
          ...(row?.updated_at
            ? { updatedAt: formatTimestamp(row.updated_at) }
            : {}),
          ...(lagFromSafeBlock === undefined
            ? {}
            : { lagFromSafeBlock: lagFromSafeBlock.toString() }),
        },
      ];
    });
  }

  private buildStaleDataIndicators(
    contracts: readonly DiagnosticsContractDto[],
    cursors: readonly DiagnosticsContractCursorDto[],
    latestChainBlock: bigint | undefined,
    latestSafeBlock: bigint | undefined,
    projectionBacklog: number,
    failedProjectionCount: number,
  ): DiagnosticsStaleDataIndicatorDto[] {
    const indicators: DiagnosticsStaleDataIndicatorDto[] = [];
    const cursorByAddress = new Map(
      cursors.map((cursor) => [cursor.address.toLowerCase(), cursor]),
    );

    for (const contract of contracts) {
      if (!contract.address) {
        indicators.push({
          code: 'contract_address_missing',
          severity: 'error',
          message: `${contract.name} address is not configured.`,
          contractName: contract.name,
        });
        continue;
      }

      const cursor = cursorByAddress.get(contract.address.toLowerCase());
      if (!cursor?.lastScannedBlock) {
        indicators.push({
          code: 'contract_cursor_missing',
          severity: 'warning',
          message: `${contract.name} has not been scanned yet.`,
          contractName: contract.name,
          contractAddress: contract.address,
          ...(latestSafeBlock === undefined
            ? {}
            : { latestSafeBlock: latestSafeBlock.toString() }),
        });
        continue;
      }

      if (cursor.lagFromSafeBlock && BigInt(cursor.lagFromSafeBlock) > 0n) {
        indicators.push({
          code: 'indexer_behind_safe_block',
          severity: 'warning',
          message: `${contract.name} indexer cursor is behind the latest safe block.`,
          contractName: contract.name,
          contractAddress: contract.address,
          lastScannedBlock: cursor.lastScannedBlock,
          ...(latestSafeBlock === undefined
            ? {}
            : { latestSafeBlock: latestSafeBlock.toString() }),
          lagBlocks: cursor.lagFromSafeBlock,
        });
      }
    }

    if (latestChainBlock === undefined) {
      indicators.push({
        code: 'latest_chain_block_unavailable',
        severity: 'warning',
        message: 'Latest chain block is unavailable from the configured RPC endpoint.',
      });
    }

    if (projectionBacklog > 0) {
      indicators.push({
        code: 'projection_backlog',
        severity: 'warning',
        message: 'Confirmed raw events are waiting to be projected.',
      });
    }

    if (failedProjectionCount > 0) {
      indicators.push({
        code: 'projection_failures',
        severity: 'error',
        message: 'One or more raw events failed projection processing.',
      });
    }

    return indicators;
  }
}

function toContractDto(
  name: DiagnosticsContractName,
  address: `0x${string}` | undefined,
): DiagnosticsContractDto {
  return address
    ? { name, configured: true, address }
    : { name, configured: false };
}

function safeBlock(latestBlock: bigint, confirmations: number): bigint {
  const confirmationDepth = BigInt(confirmations);
  return latestBlock > confirmationDepth ? latestBlock - confirmationDepth : 0n;
}

function formatTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
