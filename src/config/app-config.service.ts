import { Injectable } from '@nestjs/common';

export interface ContractConfig {
  readonly govCoreAddress?: `0x${string}`;
  readonly govProposalsAddress?: `0x${string}`;
}

@Injectable()
export class AppConfigService {
  readonly nodeEnv = this.readString('NODE_ENV', 'development');
  readonly port = this.readNumber('API_PORT', this.readNumber('PORT', 3000));
  readonly chainId = this.readNumber('CHAIN_ID', 31337);
  readonly rpcUrl = this.readString('RPC_URL', this.readString('RPC_HTTP_URL', 'http://127.0.0.1:8545'));
  readonly startBlock = BigInt(this.readNumber('START_BLOCK', 0));
  readonly confirmations = this.readNumber('CONFIRMATIONS', this.readNumber('CONFIRMATION_DEPTH', 0));
  readonly blockRangeSize = BigInt(this.readNumber('BLOCK_RANGE_SIZE', this.readNumber('MAX_BLOCK_RANGE', 1_000)));
  readonly pollIntervalMs = this.readNumber('POLL_INTERVAL_MS', 5_000);
  readonly databaseUrl = this.readDatabaseUrl();

  readonly contracts: ContractConfig = {
    govCoreAddress: this.readAddress('GOV_CORE_ADDRESS'),
    govProposalsAddress: this.readAddress('GOV_PROPOSALS_ADDRESS'),
  };

  get contractAddresses(): `0x${string}`[] {
    return [this.contracts.govCoreAddress, this.contracts.govProposalsAddress].filter(
      (address): address is `0x${string}` => Boolean(address),
    );
  }

  private readString(name: string, fallback?: string): string {
    const value = process.env[name];
    if (value !== undefined && value !== '') {
      return value;
    }
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }

  private readNumber(name: string, fallback?: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error(`Missing required environment variable: ${name}`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid numeric environment variable: ${name}`);
    }
    return value;
  }

  private readAddress(name: string): `0x${string}` | undefined {
    const value = process.env[name];
    if (!value) {
      return undefined;
    }
    if (!value.startsWith('0x')) {
      throw new Error(`Invalid address environment variable: ${name}`);
    }
    return value as `0x${string}`;
  }

  private readDatabaseUrl(): string {
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }
    const host = this.readString('PG_HOST', 'localhost');
    const port = this.readString('PG_PORT', '5432');
    const database = this.readString('PG_DATABASE', 'control-plane');
    const user = this.readString('PG_USER', 'postgres');
    const password = this.readString('PG_PASSWORD', 'secret');
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }
}
