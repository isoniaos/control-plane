const V0_7_0_ALPHA_PATTERN = /^0\.7\.0-alpha\.(\d+)$/;

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
  return {
    normalizedVersion,
    activationContractBatch: alphaVersion !== undefined && alphaVersion >= 1,
    organizationFinalization: alphaVersion !== undefined && alphaVersion >= 2,
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
