import { Injectable, Logger } from '@nestjs/common';
import { createPublicClient, decodeEventLog, http, type Address, type Log } from 'viem';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import { ISONIA_EVENT_ABI } from '../chain/isonia-abi';
import { toJsonValue } from '../chain/json';

interface DecodedGovernanceLog {
  readonly eventName: string;
  readonly args: Record<string, unknown>;
}

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private readonly client;

  constructor(
    private readonly config: AppConfigService,
    private readonly db: DatabaseService,
  ) {
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  async runOnce(): Promise<{ fromBlock: bigint; toBlock: bigint; inserted: number } | undefined> {
    const addresses = this.config.contractAddresses;
    if (addresses.length === 0) {
      throw new Error('GOV_CORE_ADDRESS and/or GOV_PROPOSALS_ADDRESS must be set before indexing');
    }

    const latestBlock = await this.client.getBlockNumber();
    const latestSafeBlock = latestBlock > BigInt(this.config.confirmations) ? latestBlock - BigInt(this.config.confirmations) : 0n;
    const fromBlock = await this.nextFromBlock(addresses);
    if (fromBlock > latestSafeBlock) {
      return undefined;
    }
    const toBlock = minBigInt(fromBlock + this.config.blockRangeSize - 1n, latestSafeBlock);
    const blockTimestampCache = new Map<bigint, string>();
    let inserted = 0;

    for (const address of addresses) {
      const logs = await this.client.getLogs({
        address: address as Address,
        fromBlock,
        toBlock,
      });
      for (const log of logs) {
        if (log.blockNumber === null || log.blockHash === null || log.transactionHash === null || log.logIndex === null) {
          continue;
        }
        const decoded = this.decodeLog(log);
        if (!decoded) {
          continue;
        }
        const blockTimestamp = await this.blockTimestamp(log.blockNumber, blockTimestampCache);
        inserted += await this.insertRawEvent(log, decoded, blockTimestamp);
      }
      await this.updateCursor(address, toBlock);
    }

    this.logger.log(`Indexed ${inserted} events from blocks ${fromBlock.toString()}-${toBlock.toString()}`);
    return { fromBlock, toBlock, inserted };
  }

  async runForever(): Promise<void> {
    for (;;) {
      await this.runOnce();
      await sleep(this.config.pollIntervalMs);
    }
  }

  private async nextFromBlock(addresses: readonly `0x${string}`[]): Promise<bigint> {
    const result = await this.db.query<{ last_scanned_block: string }>(
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

  private decodeLog(log: Log): DecodedGovernanceLog | undefined {
    try {
      const decoded = decodeEventLog({
        abi: ISONIA_EVENT_ABI,
        topics: log.topics,
        data: log.data,
      });
      return {
        eventName: decoded.eventName,
        args: toJsonValue(decoded.args) as Record<string, unknown>,
      };
    } catch {
      return undefined;
    }
  }

  private async blockTimestamp(blockNumber: bigint, cache: Map<bigint, string>): Promise<string> {
    const cached = cache.get(blockNumber);
    if (cached) {
      return cached;
    }
    const block = await this.client.getBlock({ blockNumber });
    const timestamp = block.timestamp.toString();
    cache.set(blockNumber, timestamp);
    return timestamp;
  }

  private async insertRawEvent(log: Log, decoded: DecodedGovernanceLog, blockTimestamp: string): Promise<number> {
    const result = await this.db.query(
      `
        insert into raw_events (
          chain_id,
          contract_address,
          block_number,
          block_hash,
          block_timestamp,
          tx_hash,
          log_index,
          event_name,
          args,
          raw_log,
          status,
          confirmations,
          confirmed_at
        )
        values ($1, lower($2), $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, 'confirmed', $11, now())
        on conflict (chain_id, tx_hash, log_index) do nothing
      `,
      [
        this.config.chainId,
        log.address,
        log.blockNumber!.toString(),
        log.blockHash!,
        blockTimestamp,
        log.transactionHash!,
        log.logIndex!,
        decoded.eventName,
        JSON.stringify(decoded.args),
        JSON.stringify(toJsonValue(log)),
        this.config.confirmations,
      ],
    );
    return result.rowCount ?? 0;
  }

  private async updateCursor(address: `0x${string}`, blockNumber: bigint): Promise<void> {
    await this.db.query(
      `
        insert into chain_cursors (chain_id, contract_address, last_scanned_block, last_confirmed_block, updated_at)
        values ($1, lower($2), $3, $3, now())
        on conflict (chain_id, contract_address)
        do update set
          last_scanned_block = greatest(chain_cursors.last_scanned_block, excluded.last_scanned_block),
          last_confirmed_block = greatest(coalesce(chain_cursors.last_confirmed_block, 0), excluded.last_confirmed_block),
          updated_at = now()
      `,
      [this.config.chainId, address, blockNumber.toString()],
    );
  }
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
