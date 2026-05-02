import * as fs from 'node:fs';
import * as path from 'node:path';

import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

type PackageJson = {
  readonly version: string;
};

const UNKNOWN_VERSION: string = 'unknown';

const isPackageJson = (value: unknown): value is PackageJson => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('version' in value)) {
    return false;
  }
  return typeof (value as { readonly version: unknown }).version === 'string';
};

const tryReadPackageJsonVersion = (packageJsonPath: string): string | null => {
  try {
    const raw: string = fs.readFileSync(packageJsonPath, { encoding: 'utf-8' });
    const parsed: unknown = JSON.parse(raw);
    if (!isPackageJson(parsed)) {
      return null;
    }
    return parsed.version;
  } catch {
    return null;
  }
};

const readServiceVersion = (): string => {
  const distPackageJsonPath: string = path.join(
    __dirname,
    '..',
    '..',
    'package.json',
  );
  const distVersion: string | null =
    tryReadPackageJsonVersion(distPackageJsonPath);
  if (distVersion !== null) {
    return distVersion;
  }
  const cwdPackageJsonPath: string = path.join(process.cwd(), 'package.json');
  const cwdVersion: string | null =
    tryReadPackageJsonVersion(cwdPackageJsonPath);
  if (cwdVersion !== null) {
    return cwdVersion;
  }
  return UNKNOWN_VERSION;
};

@Controller('v1')
export class SystemController {
  constructor(private readonly config: AppConfigService) {}

  @Get('health')
  getHealth(): Record<string, string> {
    return { status: 'ok' };
  }

  @Get('version')
  getVersion(): Record<string, unknown> {
    return {
      service: 'isonia-control-plane',
      version: readServiceVersion(),
      chainId: this.config.chainId,
      contracts: this.config.contracts,
    };
  }
}
