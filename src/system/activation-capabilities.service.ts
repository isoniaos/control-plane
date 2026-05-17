import { Injectable } from '@nestjs/common';
import {
  ActivationCapabilityStatus,
  ActivationExecutionMode,
  ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES,
  type ActivationCapabilities,
  type ChainId,
  ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES,
  ORGANIZATION_FINALIZATION_CONTRACT_FUNCTION_NAME_VALUES,
  type OrganizationFinalizationCapability,
} from '@isonia/types';
import { AppConfigService } from '../config/app-config.service';
import {
  deploymentCapabilitiesConfigured,
  resolveContractBatchActivationCapability,
  resolveOrganizationFinalizationCapability,
  toActivationCapabilityStatus,
  toOrganizationFinalizationCapabilityStatus,
  type IsoniaProtocolProfile,
  type RuntimeCapabilitySource,
} from './deployment-capabilities';
import { CONTROL_PLANE_API_VERSION } from './version';

export interface ControlPlaneCapabilitiesDto {
  readonly apiVersion: string;
  readonly chainId: ChainId;
  readonly activation: ActivationCapabilities;
  readonly finalization: ControlPlaneFinalizationCapabilitiesDto;
  readonly protocol: {
    readonly profile?: IsoniaProtocolProfile;
    readonly deploymentCapabilitiesConfigured: boolean;
    readonly sources: {
      readonly contractBatchActivation: RuntimeCapabilitySource;
      readonly organizationFinalization: RuntimeCapabilitySource;
    };
  };
  readonly generatedAt: string;
}

export interface ControlPlaneFinalizationCapabilitiesDto {
  readonly organization: OrganizationFinalizationCapability;
  readonly emergencyRecovery: {
    readonly status: typeof ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported;
  };
  readonly governanceControlledPostFinalizationMutation: {
    readonly status: typeof ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported;
  };
}

@Injectable()
export class ActivationCapabilitiesService {
  constructor(private readonly config: AppConfigService) {}

  getCapabilities(): ControlPlaneCapabilitiesDto {
    return {
      apiVersion: CONTROL_PLANE_API_VERSION,
      chainId: this.config.chainId,
      activation: this.getActivationCapabilities(),
      finalization: this.getFinalizationCapabilities(),
      protocol: this.getProtocolCapabilityMetadata(),
      generatedAt: new Date().toISOString(),
    };
  }

  getActivationCapabilities(): ActivationCapabilities {
    const contractBatchStatus = this.getContractBatchStatus();
    const contractBatchSupported =
      contractBatchStatus === ActivationCapabilityStatus.Supported;

    return {
      availableModes: contractBatchSupported
        ? [
            ActivationExecutionMode.Serial,
            ActivationExecutionMode.ContractBatch,
          ]
        : [ActivationExecutionMode.Serial],
      flags: {
        serial: true,
        contractBatch: contractBatchSupported,
        walletBatchEip5792: false,
      },
      contractBatch: {
        status: contractBatchStatus,
        supportedFunctions: contractBatchSupported
          ? [...ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES]
          : [],
      },
      walletBatchEip5792: {
        status: ActivationCapabilityStatus.Unsupported,
        standard: 'eip5792',
      },
    };
  }

  private getContractBatchStatus(): ActivationCapabilityStatus {
    return toActivationCapabilityStatus(
      resolveContractBatchActivationCapability(this.config),
    );
  }

  getFinalizationCapabilities(): ControlPlaneFinalizationCapabilitiesDto {
    const status = toOrganizationFinalizationCapabilityStatus(
      resolveOrganizationFinalizationCapability(this.config),
    );

    return {
      organization: {
        status,
        supportedFunctions:
          status === ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Supported
            ? [...ORGANIZATION_FINALIZATION_CONTRACT_FUNCTION_NAME_VALUES]
            : [],
      },
      emergencyRecovery: {
        status: ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported,
      },
      governanceControlledPostFinalizationMutation: {
        status: ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported,
      },
    };
  }

  private getProtocolCapabilityMetadata(): ControlPlaneCapabilitiesDto['protocol'] {
    const contractBatchActivation = resolveContractBatchActivationCapability(
      this.config,
    );
    const organizationFinalization = resolveOrganizationFinalizationCapability(
      this.config,
    );

    return {
      ...(this.config.protocolProfile
        ? { profile: this.config.protocolProfile }
        : {}),
      deploymentCapabilitiesConfigured: deploymentCapabilitiesConfigured(
        this.config.deploymentCapabilities,
      ),
      sources: {
        contractBatchActivation: contractBatchActivation.source,
        organizationFinalization: organizationFinalization.source,
      },
    };
  }
}
