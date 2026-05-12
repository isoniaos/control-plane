import { Injectable } from '@nestjs/common';
import {
  GovernanceEventName,
  ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES,
} from '@isonia/types';
import type {
  Address,
  ChainId,
  DiagnosticsContractCursorDto,
  DiagnosticsContractDto,
  DiagnosticsContractName,
  DiagnosticsDto,
  DiagnosticsProjectionErrorDto,
  DiagnosticsRawEventCountsDto,
  DiagnosticsStaleDataIndicatorDto,
  NumericString,
  TransactionHash,
} from '@isonia/types';
import { createPublicClient, http, type PublicClient } from 'viem';
import { AppConfigService } from '../config/app-config.service';
import { maskUrl } from '../config/safe-url';
import { DatabaseService } from '../database/database.service';
import { getEvmContractsCompatibility } from '../system/evm-contract-version';
import { CONTROL_PLANE_API_VERSION } from '../system/version';
import {
  RuntimeHeartbeatService,
  type RuntimeProcessHeartbeatDto,
} from './runtime-heartbeat.service';

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

interface LastProjectedCursorRow {
  readonly block_number: string;
  readonly tx_hash: string;
  readonly log_index: number;
  readonly processed_at: Date | string;
}

export interface ProjectionCursorDto {
  readonly blockNumber: NumericString;
  readonly txHash: TransactionHash;
  readonly logIndex: number;
  readonly processedAt: string;
}

export interface IndexerDiagnosticsDto {
  readonly apiVersion: string;
  readonly chainId: ChainId;
  readonly generatedAt: string;
  readonly runtime: {
    readonly staleAfterMs: number;
    readonly processes: RuntimeProcessHeartbeatDto[];
  };
  readonly indexer: {
    readonly rpcUrl: string;
    readonly contracts: DiagnosticsContractDto[];
    readonly fromBlock: NumericString;
    readonly pollingIntervalMs: number;
    readonly safeBlockLag: number;
    readonly latestChainBlock?: NumericString;
    readonly latestSafeBlock?: NumericString;
    readonly lastScannedBlocks: DiagnosticsContractCursorDto[];
    readonly rawEventCounts: DiagnosticsRawEventCountsDto;
    readonly staleDataIndicators: DiagnosticsStaleDataIndicatorDto[];
  };
  readonly projections: {
    readonly store: string;
    readonly pollingIntervalMs: number;
    readonly lastProjectedCursor: ProjectionCursorDto | null;
    readonly projectionBacklog: number;
    readonly failedProjectionCount: number;
    readonly latestProjectionError?: DiagnosticsProjectionErrorDto;
  };
}

export interface ControlPlaneDiagnosticsDto extends DiagnosticsDto {
  readonly protocol: {
    readonly evmContractsVersion?: string;
    readonly finalization: {
      readonly eventName: typeof GovernanceEventName.OrganizationFinalized;
      readonly eventDecodingSupported: true;
      readonly status: string;
      readonly rawEventCount: number;
      readonly projectedEventCount: number;
      readonly emergencyRecoverySupported: false;
      readonly governanceControlledPostFinalizationMutationSupported: false;
      readonly latestProjectionError?: DiagnosticsProjectionErrorDto;
    };
  };
}

@Injectable()
export class DiagnosticsService {
  private readonly client: PublicClient;

  constructor(
    private readonly config: AppConfigService,
    private readonly db: DatabaseService,
    private readonly runtimeHeartbeats: RuntimeHeartbeatService,
  ) {
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  async getDiagnostics(): Promise<ControlPlaneDiagnosticsDto> {
    const contracts = this.getConfiguredContracts();
    const latestChainBlock = await this.getLatestChainBlockOrUndefined();
    const latestSafeBlock =
      latestChainBlock === undefined
        ? undefined
        : safeBlock(latestChainBlock, this.config.confirmations);

    const [
      cursorRows,
      rawEventCounts,
      projectionSummary,
      latestError,
      finalizationEventCounts,
      latestFinalizationError,
    ] = await Promise.all([
      this.getCursorRows(contracts),
      this.getRawEventCounts(),
      this.getProjectionSummary(),
      this.getLatestProjectionError(),
      this.getFinalizationEventCounts(),
      this.getLatestProjectionError(GovernanceEventName.OrganizationFinalized),
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
      protocol: {
        ...(this.config.evmContractsVersion
          ? { evmContractsVersion: this.config.evmContractsVersion }
          : {}),
        finalization: {
          eventName: GovernanceEventName.OrganizationFinalized,
          eventDecodingSupported: true,
          status: this.getFinalizationCapabilityStatus(),
          rawEventCount: finalizationEventCounts.rawEventCount,
          projectedEventCount: finalizationEventCounts.projectedEventCount,
          emergencyRecoverySupported: false,
          governanceControlledPostFinalizationMutationSupported: false,
          ...(latestFinalizationError
            ? { latestProjectionError: latestFinalizationError }
            : {}),
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getIndexerDiagnostics(): Promise<IndexerDiagnosticsDto> {
    const [diagnostics, processes, fromBlock, lastProjectedCursor] =
      await Promise.all([
        this.getDiagnostics(),
        this.runtimeHeartbeats.getProcesses(['api', 'indexer', 'projections']),
        this.getNextFromBlock(),
        this.getLastProjectedCursor(),
      ]);

    return {
      apiVersion: CONTROL_PLANE_API_VERSION,
      chainId: this.config.chainId,
      generatedAt: new Date().toISOString(),
      runtime: {
        staleAfterMs: this.runtimeHeartbeats.staleAfterMs,
        processes,
      },
      indexer: {
        rpcUrl: maskUrl(this.config.rpcUrl),
        contracts: diagnostics.contracts,
        fromBlock: fromBlock.toString(),
        pollingIntervalMs: this.config.pollIntervalMs,
        safeBlockLag: this.config.confirmations,
        ...(diagnostics.latestChainBlock
          ? { latestChainBlock: diagnostics.latestChainBlock }
          : {}),
        ...(diagnostics.latestSafeBlock
          ? { latestSafeBlock: diagnostics.latestSafeBlock }
          : {}),
        lastScannedBlocks: diagnostics.lastScannedBlocks,
        rawEventCounts: diagnostics.rawEventCounts,
        staleDataIndicators: diagnostics.staleDataIndicators.filter(
          (indicator) =>
            indicator.code !== 'projection_backlog' &&
            indicator.code !== 'projection_failures',
        ),
      },
      projections: {
        store: maskUrl(this.config.databaseUrl),
        pollingIntervalMs: this.config.pollIntervalMs,
        lastProjectedCursor,
        projectionBacklog: diagnostics.projectionBacklog,
        failedProjectionCount: diagnostics.failedProjectionCount,
        ...(diagnostics.latestProjectionError
          ? { latestProjectionError: diagnostics.latestProjectionError }
          : {}),
      },
    };
  }

  private getConfiguredContracts(): DiagnosticsContractDto[] {
    return [
      toContractDto('govCore', this.config.contracts.govCoreAddress),
      toContractDto('govProposals', this.config.contracts.govProposalsAddress),
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

  private async getLatestProjectionError(
    eventName?: GovernanceEventName,
  ): Promise<DiagnosticsProjectionErrorDto | undefined> {
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
          and ($2::text is null or event_name = $2)
          and (failed_at is not null or error is not null or status = 'failed')
        order by failed_at desc nulls last, updated_at desc
        limit 1
      `,
      [this.config.chainId, eventName ?? null],
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

  private async getNextFromBlock(): Promise<bigint> {
    const addresses = this.config.contractAddresses;
    if (addresses.length === 0) {
      return this.config.startBlock;
    }
    const result = await this.db.query<{ last_scanned_block: string | null }>(
      `
        select min(last_scanned_block) as last_scanned_block
        from chain_cursors
        where chain_id = $1 and contract_address = any($2)
      `,
      [this.config.chainId, addresses.map((address) => address.toLowerCase())],
    );
    const value = result.rows[0]?.last_scanned_block;
    if (value === null || value === undefined) {
      return this.config.startBlock;
    }
    return BigInt(value) + 1n;
  }

  private async getLastProjectedCursor(): Promise<ProjectionCursorDto | null> {
    const result = await this.db.query<LastProjectedCursorRow>(
      `
        select block_number, tx_hash, log_index, processed_at
        from raw_events
        where chain_id = $1 and processed_at is not null
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
      txHash: row.tx_hash as TransactionHash,
      logIndex: row.log_index,
      processedAt: formatTimestamp(row.processed_at),
    };
  }

  private async getFinalizationEventCounts(): Promise<{
    rawEventCount: number;
    projectedEventCount: number;
  }> {
    const result = await this.db.query<{
      rawEventCount: number | string;
      projectedEventCount: number | string;
    }>(
      `
        select
          count(*)::int as "rawEventCount",
          count(*) filter (where processed_at is not null)::int as "projectedEventCount"
        from raw_events
        where chain_id = $1 and event_name = $2
      `,
      [this.config.chainId, GovernanceEventName.OrganizationFinalized],
    );
    const row = result.rows[0];
    return {
      rawEventCount: Number(row?.rawEventCount ?? 0),
      projectedEventCount: Number(row?.projectedEventCount ?? 0),
    };
  }

  private getFinalizationCapabilityStatus(): string {
    const compatibility = getEvmContractsCompatibility(
      this.config.evmContractsVersion,
    );
    if (!compatibility) {
      return ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unknown;
    }
    return compatibility.organizationFinalization
      ? ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Supported
      : ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported;
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
        message:
          'Latest chain block is unavailable from the configured RPC endpoint.',
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
