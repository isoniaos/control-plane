import { Injectable } from '@nestjs/common';
import {
  ISONIA_PROTOCOL_ADDRESS_ENV_VARS,
  type IsoniaProtocolAddressConfigDto,
} from '@isonia/types';
import {
  parseDeploymentCapabilitiesJson,
  parseIsoniaProtocolProfile,
  type DeploymentCapabilitiesConfig,
  type IsoniaProtocolProfile,
} from '../system/deployment-capabilities';

export type ContractConfig = IsoniaProtocolAddressConfigDto;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

@Injectable()
export class AppConfigService {
  readonly nodeEnv = this.readString('NODE_ENV', 'development');
  readonly port = this.readNumber('API_PORT', this.readNumber('PORT', 3000));
  readonly chainId = this.readNumber('CHAIN_ID', 31337);
  readonly rpcUrl = this.readString(
    'RPC_URL',
    this.readString('RPC_HTTP_URL', 'http://127.0.0.1:8545'),
  );
  readonly startBlock = BigInt(this.readNumber('START_BLOCK', 0));
  readonly confirmations = this.readNumber(
    'CONFIRMATIONS',
    this.readNumber('CONFIRMATION_DEPTH', 0),
  );
  readonly blockRangeSize = BigInt(
    this.readNumber(
      'BLOCK_RANGE_SIZE',
      this.readNumber('MAX_BLOCK_RANGE', 1_000),
    ),
  );
  readonly pollIntervalMs = this.readNumber('POLL_INTERVAL_MS', 5_000);
  readonly databaseUrl = this.readDatabaseUrl();
  readonly corsOrigins = this.readStringList('CORS_ORIGINS', [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  readonly corsCredentials = this.readBoolean('CORS_CREDENTIALS', false);
  readonly protocolProfile: IsoniaProtocolProfile | undefined =
    parseIsoniaProtocolProfile(
      this.readOptionalString('ISONIA_PROTOCOL_PROFILE'),
    );
  readonly deploymentCapabilities: DeploymentCapabilitiesConfig =
    parseDeploymentCapabilitiesJson(
      this.readOptionalString('ISONIA_DEPLOYMENT_CAPABILITIES_JSON'),
    );

  readonly contracts: ContractConfig = {
    isoCoreAddress: this.readAddress(ISONIA_PROTOCOL_ADDRESS_ENV_VARS.IsoCore),
    isoProposalsAddress: this.readAddress(
      ISONIA_PROTOCOL_ADDRESS_ENV_VARS.IsoProposals,
    ),
  };

  get contractAddresses(): `0x${string}`[] {
    return [
      this.contracts.isoCoreAddress,
      this.contracts.isoProposalsAddress,
    ].filter((address): address is `0x${string}` => Boolean(address));
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

  private readOptionalString(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
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

  private readBoolean(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
      return fallback;
    }
    const value = raw.toLowerCase();
    if (['true', '1', 'yes'].includes(value)) {
      return true;
    }
    if (['false', '0', 'no'].includes(value)) {
      return false;
    }
    throw new Error(`Invalid boolean environment variable: ${name}`);
  }

  private readStringList(name: string, fallback: readonly string[]): string[] {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
      return [...fallback];
    }
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private readAddress(name: string): `0x${string}` | undefined {
    const value = process.env[name];
    if (!value) {
      return undefined;
    }
    if (!EVM_ADDRESS_PATTERN.test(value)) {
      throw new Error(`Invalid address environment variable: ${name}`);
    }
    if (value.toLowerCase() === ZERO_ADDRESS) {
      throw new Error(
        `Zero address is not valid for environment variable: ${name}`,
      );
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
