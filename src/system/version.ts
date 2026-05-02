import * as fs from 'node:fs';
import * as path from 'node:path';

export const CONTROL_PLANE_API_VERSION = 'v1';

type PackageJson = {
  readonly version: string;
};

const UNKNOWN_VERSION = 'unknown';

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
    const raw = fs.readFileSync(packageJsonPath, { encoding: 'utf-8' });
    const parsed: unknown = JSON.parse(raw);
    if (!isPackageJson(parsed)) {
      return null;
    }
    return parsed.version;
  } catch {
    return null;
  }
};

export const readServiceVersion = (): string => {
  const distPackageJsonPath = path.join(__dirname, '..', '..', 'package.json');
  const distVersion = tryReadPackageJsonVersion(distPackageJsonPath);
  if (distVersion !== null) {
    return distVersion;
  }
  const cwdPackageJsonPath = path.join(process.cwd(), 'package.json');
  const cwdVersion = tryReadPackageJsonVersion(cwdPackageJsonPath);
  if (cwdVersion !== null) {
    return cwdVersion;
  }
  return UNKNOWN_VERSION;
};
