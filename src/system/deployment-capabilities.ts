import {
  ActivationCapabilityStatus,
  DeploymentCapabilityStatus,
  ISONIA_PROTOCOL_ADDRESS_ENV_VARS,
  ISONIA_PROTOCOL_CONTRACT_NAMES,
  IsoniaProtocolProfile,
  ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES,
  RuntimeCapabilitySource,
  type DeploymentCapabilitiesConfigDto,
  type DeploymentCapabilityResolutionInputDto,
  type OrganizationFinalizationCapabilityStatus,
  type RuntimeCapabilityResolutionDto,
} from '@isonia/types';

export const ISONIA_PROTOCOL_PROFILES = [
  IsoniaProtocolProfile.Current,
  IsoniaProtocolProfile.Legacy,
  IsoniaProtocolProfile.Custom,
] as const;

export {
  DeploymentCapabilityStatus,
  IsoniaProtocolProfile,
  RuntimeCapabilitySource,
};

export const DEPLOYMENT_CAPABILITY_STATUSES = {
  Supported: DeploymentCapabilityStatus.Supported,
  Unsupported: DeploymentCapabilityStatus.Unsupported,
  Unknown: DeploymentCapabilityStatus.Unknown,
} as const;

export type DeploymentCapabilitiesConfig = DeploymentCapabilitiesConfigDto;
export type RuntimeCapabilityResolution = RuntimeCapabilityResolutionDto;

type CapabilityResolutionInput = DeploymentCapabilityResolutionInputDto;

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

  const capabilities: {
    contractBatchActivation?: DeploymentCapabilityStatus;
    organizationFinalization?: DeploymentCapabilityStatus;
    executionPermissionRegistry?: DeploymentCapabilityStatus;
  } = {};
  const contractBatchActivation = readCapabilityStatus(value, [
    ['contractBatchActivation'],
    ['activation', 'contractBatch'],
    ['activation', 'contractBatchActivation'],
  ]);
  if (contractBatchActivation) {
    capabilities.contractBatchActivation = contractBatchActivation;
  }
  const organizationFinalization = readCapabilityStatus(value, [
    ['organizationFinalization'],
    ['finalization', 'organization'],
    ['finalization', 'organizationFinalization'],
  ]);
  if (organizationFinalization) {
    capabilities.organizationFinalization = organizationFinalization;
  }
  const executionPermissionRegistry = readCapabilityStatus(value, [
    ['executionPermissionRegistry'],
    ['executionPermissions'],
    ['execution', 'permissions'],
    ['execution', 'permissionRegistry'],
  ]);
  if (executionPermissionRegistry) {
    capabilities.executionPermissionRegistry = executionPermissionRegistry;
  }
  return capabilities;
}

export function deploymentCapabilitiesConfigured(
  capabilities: DeploymentCapabilitiesConfig,
): boolean {
  return Boolean(
    capabilities.contractBatchActivation ||
    capabilities.organizationFinalization ||
    capabilities.executionPermissionRegistry,
  );
}

export function resolveContractBatchActivationCapability(
  input: CapabilityResolutionInput,
): RuntimeCapabilityResolution {
  const explicit = input.deploymentCapabilities.contractBatchActivation;
  if (explicit) {
    return {
      status: explicit,
      source: RuntimeCapabilitySource.DeploymentCapabilities,
      reason:
        'Contract batch activation was resolved from explicit deployment capability metadata.',
    };
  }

  return resolveCurrentIsoCoreCapability(input, 'Contract batch activation');
}

export function resolveOrganizationFinalizationCapability(
  input: CapabilityResolutionInput,
): RuntimeCapabilityResolution {
  const explicit = input.deploymentCapabilities.organizationFinalization;
  if (explicit) {
    return {
      status: explicit,
      source: RuntimeCapabilitySource.DeploymentCapabilities,
      reason:
        'Organization finalization was resolved from explicit deployment capability metadata.',
    };
  }

  return resolveCurrentIsoCoreCapability(input, 'Organization finalization');
}

export function resolveExecutionPermissionRegistryCapability(
  input: CapabilityResolutionInput,
): RuntimeCapabilityResolution {
  const explicit = input.deploymentCapabilities.executionPermissionRegistry;
  if (explicit) {
    return {
      status: explicit,
      source: RuntimeCapabilitySource.DeploymentCapabilities,
      reason:
        'Execution permission registry was resolved from explicit deployment capability metadata.',
    };
  }

  return resolveCurrentIsoProposalsCapability(
    input,
    'Execution permission registry',
  );
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

function resolveCurrentIsoCoreCapability(
  input: CapabilityResolutionInput,
  label: string,
): RuntimeCapabilityResolution {
  if (input.protocolProfile === IsoniaProtocolProfile.Legacy) {
    return {
      status: DEPLOYMENT_CAPABILITY_STATUSES.Unsupported,
      source: RuntimeCapabilitySource.ProtocolProfile,
      reason: `${label} is disabled by the configured legacy protocol profile.`,
    };
  }

  if (input.protocolProfile === IsoniaProtocolProfile.Current) {
    if (input.contracts.isoCoreAddress) {
      return {
        status: DEPLOYMENT_CAPABILITY_STATUSES.Supported,
        source: RuntimeCapabilitySource.ContractAddressPresence,
        reason: `${label} is enabled by the current protocol profile and configured ${ISONIA_PROTOCOL_CONTRACT_NAMES.IsoCore} address.`,
      };
    }
    return {
      status: DEPLOYMENT_CAPABILITY_STATUSES.Unknown,
      source: RuntimeCapabilitySource.ContractAddressPresence,
      reason: `${label} cannot be proven because ${ISONIA_PROTOCOL_ADDRESS_ENV_VARS.IsoCore} is not configured.`,
    };
  }

  return {
    status: DEPLOYMENT_CAPABILITY_STATUSES.Unknown,
    source: RuntimeCapabilitySource.Unknown,
    reason: `${label} cannot be proven without deployment capabilities or a supported protocol profile.`,
  };
}

function resolveCurrentIsoProposalsCapability(
  input: CapabilityResolutionInput,
  label: string,
): RuntimeCapabilityResolution {
  if (input.protocolProfile === IsoniaProtocolProfile.Legacy) {
    return {
      status: DEPLOYMENT_CAPABILITY_STATUSES.Unsupported,
      source: RuntimeCapabilitySource.ProtocolProfile,
      reason: `${label} is disabled by the configured legacy protocol profile.`,
    };
  }

  if (input.protocolProfile === IsoniaProtocolProfile.Current) {
    if (input.contracts.isoProposalsAddress) {
      return {
        status: DEPLOYMENT_CAPABILITY_STATUSES.Supported,
        source: RuntimeCapabilitySource.ContractAddressPresence,
        reason: `${label} is enabled by the current protocol profile and configured ${ISONIA_PROTOCOL_CONTRACT_NAMES.IsoProposals} address.`,
      };
    }
    return {
      status: DEPLOYMENT_CAPABILITY_STATUSES.Unknown,
      source: RuntimeCapabilitySource.ContractAddressPresence,
      reason: `${label} cannot be proven because ${ISONIA_PROTOCOL_ADDRESS_ENV_VARS.IsoProposals} is not configured.`,
    };
  }

  return {
    status: DEPLOYMENT_CAPABILITY_STATUSES.Unknown,
    source: RuntimeCapabilitySource.Unknown,
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
