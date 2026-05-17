const V0_7_0_ALPHA_PATTERN = /^0\.7\.0-alpha\.(\d+)$/;
const V0_8_0_ALPHA_PATTERN = /^0\.8\.0-alpha\.(\d+)$/;

export interface EvmContractsCompatibility {
  readonly normalizedVersion: string;
  readonly activationContractBatch: boolean;
  readonly organizationFinalization: boolean;
}

export function getEvmContractsCompatibility(
  version: string | undefined,
): EvmContractsCompatibility | undefined {
  const normalizedVersion = normalizeEvmContractsVersion(version);
  if (!normalizedVersion) {
    return undefined;
  }

  const alphaVersion = parseV070AlphaVersion(normalizedVersion);
  const v080AlphaVersion = parseV080AlphaVersion(normalizedVersion);
  const isV08AccountabilityBaseline =
    v080AlphaVersion !== undefined && v080AlphaVersion >= 1;
  return {
    normalizedVersion,
    activationContractBatch:
      (alphaVersion !== undefined && alphaVersion >= 1) ||
      isV08AccountabilityBaseline,
    organizationFinalization:
      (alphaVersion !== undefined && alphaVersion >= 2) ||
      isV08AccountabilityBaseline,
  };
}

export function normalizeEvmContractsVersion(
  version: string | undefined,
): string {
  if (!version) {
    return '';
  }
  const trimmed = version.trim();
  const packageSeparatorIndex = trimmed.lastIndexOf('@');
  const withoutPackage =
    packageSeparatorIndex > 0
      ? trimmed.slice(packageSeparatorIndex + 1)
      : trimmed;
  return withoutPackage.startsWith('v')
    ? withoutPackage.slice(1)
    : withoutPackage;
}

function parseV070AlphaVersion(version: string): number | undefined {
  const match = V0_7_0_ALPHA_PATTERN.exec(version);
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

function parseV080AlphaVersion(version: string): number | undefined {
  const match = V0_8_0_ALPHA_PATTERN.exec(version);
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}
