import { Injectable } from '@nestjs/common';
import {
  ActivationCapabilityStatus,
  ActivationExecutionMode,
  ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES,
  type ActivationCapabilities,
  type ChainId,
} from '@isonia/types';
import { AppConfigService } from '../config/app-config.service';
import { CONTROL_PLANE_API_VERSION } from './version';

export interface ControlPlaneCapabilitiesDto {
  readonly apiVersion: string;
  readonly chainId: ChainId;
  readonly activation: ActivationCapabilities;
  readonly generatedAt: string;
}

const V0_7_TYPED_BATCH_CONTRACT_VERSION = '0.7.0-alpha.1';

@Injectable()
export class ActivationCapabilitiesService {
  constructor(private readonly config: AppConfigService) {}

  getCapabilities(): ControlPlaneCapabilitiesDto {
    return {
      apiVersion: CONTROL_PLANE_API_VERSION,
      chainId: this.config.chainId,
      activation: this.getActivationCapabilities(),
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
    const normalizedVersion = normalizeEvmContractsVersion(
      this.config.evmContractsVersion,
    );
    if (!normalizedVersion) {
      return ActivationCapabilityStatus.Unknown;
    }
    if (normalizedVersion === V0_7_TYPED_BATCH_CONTRACT_VERSION) {
      return ActivationCapabilityStatus.Supported;
    }
    return ActivationCapabilityStatus.Unsupported;
  }
}

function normalizeEvmContractsVersion(version: string | undefined): string {
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
