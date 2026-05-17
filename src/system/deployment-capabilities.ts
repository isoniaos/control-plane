import {
  ActivationCapabilityStatus,
  ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES,
  type OrganizationFinalizationCapabilityStatus,
} from '@isonia/types';

export const ISONIA_PROTOCOL_PROFILES = [
  'current',
  'legacy',
  'custom',
] as const;

export type IsoniaProtocolProfile = (typeof ISONIA_PROTOCOL_PROFILES)[number];

export const DEPLOYMENT_CAPABILITY_STATUSES = {
  Supported: 'supported',
  Unsupported: 'unsupported',
  Unknown: 'unknown',
} as const;

export type DeploymentCapabilityStatus =
  (typeof DEPLOYMENT_CAPABILITY_STATUSES)[keyof typeof DEPLOYMENT_CAPABILITY_STATUSES];

export interface DeploymentCapabilitiesConfig {
  readonly contractBatchActivation?: DeploymentCapabilityStatus;
  readonly organizationFinalization?: DeploymentCapabilityStatus;
}

export type RuntimeCapabilitySource =
  | 'deployment_capabilities'
  | 'protocol_profile'
  | 'contract_address_presence'
  | 'unknown';

export interface RuntimeCapabilityResolution {
  readonly status: DeploymentCapabilityStatus;
  readonly source: RuntimeCapabilitySource;
  readonly reason: string;
}

interface CapabilityResolutionInput {
  readonly protocolProfile?: IsoniaProtocolProfile;
  readonly deploymentCapabilities: DeploymentCapabilitiesConfig;
  readonly contracts: {
    readonly govCoreAddress?: `0x${string}`;
    readonly govProposalsAddress?: `0x${string}`;
  };
}

export function parseIsoniaProtocolProfile(
  value: string | undefined,
): IsoniaProtocolProfile | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (ISONIA_PROTOCOL_PROFILES.includes(normalized as IsoniaProtocolProfile)) {
    return normalized as IsoniaProtocolProfile;
  }
  throw new Error(
    `Invalid ISONIA_PROTOCOL_PROFILE. Expected one of: ${ISONIA_PROTOCOL_PROFILES.join(
      ', ',
    )}`,
  );
}

export function parseDeploymentCapabilitiesJson(
  raw: string | undefined,
): DeploymentCapabilitiesConfig {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return {};
  }

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    throw new Error(
      'Invalid JSON environment variable: ISONIA_DEPLOYMENT_CAPABILITIES_JSON',
    );
  }

  if (!isRecord(value)) {
    throw new Error(
      'Invalid ISONIA_DEPLOYMENT_CAPABILITIES_JSON. Expected a JSON object.',
    );
  }

  return {
    contractBatchActivation: readCapabilityStatus(value, [
      ['contractBatchActivation'],
      ['activation', 'contractBatch'],
      ['activation', 'contractBatchActivation'],
    ]),
    organizationFinalization: readCapabilityStatus(value, [
      ['organizationFinalization'],
      ['finalization', 'organization'],
      ['finalization', 'organizationFinalization'],
    ]),
  };
}

export function deploymentCapabilitiesConfigured(
  capabilities: DeploymentCapabilitiesConfig,
): boolean {
  return Boolean(
    capabilities.contractBatchActivation ||
    capabilities.organizationFinalization,
  );
}

export function resolveContractBatchActivationCapability(
  input: CapabilityResolutionInput,
): RuntimeCapabilityResolution {
  const explicit = input.deploymentCapabilities.contractBatchActivation;
  if (explicit) {
    return {
      status: explicit,
      source: 'deployment_capabilities',
      reason:
        'Contract batch activation was resolved from explicit deployment capability metadata.',
    };
  }

  return resolveCurrentGovCoreCapability(input, 'Contract batch activation');
}

export function resolveOrganizationFinalizationCapability(
  input: CapabilityResolutionInput,
): RuntimeCapabilityResolution {
  const explicit = input.deploymentCapabilities.organizationFinalization;
  if (explicit) {
    return {
      status: explicit,
      source: 'deployment_capabilities',
      reason:
        'Organization finalization was resolved from explicit deployment capability metadata.',
    };
  }

  return resolveCurrentGovCoreCapability(input, 'Organization finalization');
}

export function toActivationCapabilityStatus(
  resolution: RuntimeCapabilityResolution,
): ActivationCapabilityStatus {
  switch (resolution.status) {
    case DEPLOYMENT_CAPABILITY_STATUSES.Supported:
      return ActivationCapabilityStatus.Supported;
    case DEPLOYMENT_CAPABILITY_STATUSES.Unsupported:
      return ActivationCapabilityStatus.Unsupported;
    case DEPLOYMENT_CAPABILITY_STATUSES.Unknown:
      return ActivationCapabilityStatus.Unknown;
  }
}

export function toOrganizationFinalizationCapabilityStatus(
  resolution: RuntimeCapabilityResolution,
): OrganizationFinalizationCapabilityStatus {
  switch (resolution.status) {
    case DEPLOYMENT_CAPABILITY_STATUSES.Supported:
      return ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Supported;
    case DEPLOYMENT_CAPABILITY_STATUSES.Unsupported:
      return ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported;
    case DEPLOYMENT_CAPABILITY_STATUSES.Unknown:
      return ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unknown;
  }
}

function resolveCurrentGovCoreCapability(
  input: CapabilityResolutionInput,
  label: string,
): RuntimeCapabilityResolution {
  if (input.protocolProfile === 'legacy') {
    return {
      status: DEPLOYMENT_CAPABILITY_STATUSES.Unsupported,
      source: 'protocol_profile',
      reason: `${label} is disabled by the configured legacy protocol profile.`,
    };
  }

  if (input.protocolProfile === 'current') {
    if (input.contracts.govCoreAddress) {
      return {
        status: DEPLOYMENT_CAPABILITY_STATUSES.Supported,
        source: 'contract_address_presence',
        reason: `${label} is enabled by the current protocol profile and configured GovCore address.`,
      };
    }
    return {
      status: DEPLOYMENT_CAPABILITY_STATUSES.Unknown,
      source: 'contract_address_presence',
      reason: `${label} cannot be proven because GOV_CORE_ADDRESS is not configured.`,
    };
  }

  return {
    status: DEPLOYMENT_CAPABILITY_STATUSES.Unknown,
    source: 'unknown',
    reason: `${label} cannot be proven without deployment capabilities or a supported protocol profile.`,
  };
}

function readCapabilityStatus(
  root: Record<string, unknown>,
  paths: readonly (readonly string[])[],
): DeploymentCapabilityStatus | undefined {
  for (const path of paths) {
    const value = readPath(root, path);
    if (value !== undefined) {
      return toDeploymentCapabilityStatus(value, path.join('.'));
    }
  }
  return undefined;
}

function readPath(
  root: Record<string, unknown>,
  path: readonly string[],
): unknown {
  let value: unknown = root;
  for (const segment of path) {
    if (!isRecord(value) || !(segment in value)) {
      return undefined;
    }
    value = value[segment];
  }
  return value;
}

function toDeploymentCapabilityStatus(
  value: unknown,
  path: string,
): DeploymentCapabilityStatus {
  if (typeof value === 'boolean') {
    return value
      ? DEPLOYMENT_CAPABILITY_STATUSES.Supported
      : DEPLOYMENT_CAPABILITY_STATUSES.Unsupported;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return DEPLOYMENT_CAPABILITY_STATUSES.Supported;
    }
    if (normalized === 'false') {
      return DEPLOYMENT_CAPABILITY_STATUSES.Unsupported;
    }
    if (
      Object.values(DEPLOYMENT_CAPABILITY_STATUSES).includes(
        normalized as DeploymentCapabilityStatus,
      )
    ) {
      return normalized as DeploymentCapabilityStatus;
    }
  }
  throw new Error(
    `Invalid deployment capability value at ${path}. Expected supported, unsupported, unknown, true, or false.`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
