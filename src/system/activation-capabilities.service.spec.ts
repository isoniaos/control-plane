import {
  ActivationCapabilityStatus,
  ActivationExecutionMode,
  ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES,
  ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES,
  ORGANIZATION_FINALIZATION_CONTRACT_FUNCTION_NAME_VALUES,
} from '@isonia/types';
import { AppConfigService } from '../config/app-config.service';
import type {
  DeploymentCapabilitiesConfig,
  IsoniaProtocolProfile,
} from './deployment-capabilities';
import { ActivationCapabilitiesService } from './activation-capabilities.service';

describe('ActivationCapabilitiesService', () => {
  it('reports serial activation as the fallback when contract support is unknown', () => {
    const service = createService();

    const capabilities = service.getActivationCapabilities();

    expect(capabilities.availableModes).toEqual([
      ActivationExecutionMode.Serial,
    ]);
    expect(capabilities.flags).toEqual({
      serial: true,
      contractBatch: false,
      walletBatchEip5792: false,
    });
    expect(capabilities.contractBatch).toEqual({
      status: ActivationCapabilityStatus.Unknown,
      supportedFunctions: [],
    });
  });

  it('reports contract batch activation support from current profile and configured GovCore address', () => {
    const service = createService({
      protocolProfile: 'current',
      govCoreAddress: '0x0000000000000000000000000000000000000001',
    });

    const capabilities = service.getActivationCapabilities();

    expect(capabilities.availableModes).toEqual([
      ActivationExecutionMode.Serial,
      ActivationExecutionMode.ContractBatch,
    ]);
    expect(capabilities.flags.contractBatch).toBe(true);
    expect(capabilities.contractBatch).toEqual({
      status: ActivationCapabilityStatus.Supported,
      supportedFunctions: [...ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES],
    });
  });

  it('uses explicit deployment capability metadata before profile defaults', () => {
    const service = createService({
      protocolProfile: 'legacy',
      deploymentCapabilities: {
        contractBatchActivation: 'supported',
        organizationFinalization: 'supported',
      },
    });

    const capabilities = service.getCapabilities();

    expect(capabilities.activation.flags.contractBatch).toBe(true);
    expect(capabilities.finalization.organization.status).toBe(
      ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Supported,
    );
    expect(capabilities.protocol).toMatchObject({
      profile: 'legacy',
      deploymentCapabilitiesConfigured: true,
      sources: {
        contractBatchActivation: 'deployment_capabilities',
        organizationFinalization: 'deployment_capabilities',
      },
    });
  });

  it('does not report EIP-5792 as a primary or available activation mode', () => {
    const service = createService({
      protocolProfile: 'current',
      govCoreAddress: '0x0000000000000000000000000000000000000001',
    });

    const capabilities = service.getActivationCapabilities();

    expect(capabilities.availableModes).not.toContain(
      ActivationExecutionMode.WalletBatchEip5792,
    );
    expect(capabilities.flags.walletBatchEip5792).toBe(false);
    expect(capabilities.walletBatchEip5792).toEqual({
      status: ActivationCapabilityStatus.Unsupported,
      standard: 'eip5792',
    });
  });

  it('does not expose RPC or database secrets in the capability response', () => {
    const service = createService({
      protocolProfile: 'current',
      govCoreAddress: '0x0000000000000000000000000000000000000001',
      rpcUrl: 'https://example.invalid/rpc?token=secret-rpc-token',
      databaseUrl: 'postgres://postgres:secret-db-pass@localhost/control-plane',
    });

    const serialized = JSON.stringify(service.getCapabilities());

    expect(serialized).not.toContain('secret-rpc-token');
    expect(serialized).not.toContain('secret-db-pass');
    expect(serialized).not.toContain('postgres://');
  });

  it('reports finalization as unsupported for legacy deployment profiles', () => {
    const service = createService({ protocolProfile: 'legacy' });

    const capabilities = service.getCapabilities();

    expect(capabilities.finalization.organization).toEqual({
      status: ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported,
      supportedFunctions: [],
    });
    expect(capabilities.finalization.emergencyRecovery.status).toBe(
      ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported,
    );
    expect(
      capabilities.finalization.governanceControlledPostFinalizationMutation
        .status,
    ).toBe(ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported);
  });

  it('reports finalization as supported from current profile and configured GovCore address', () => {
    const service = createService({
      protocolProfile: 'current',
      govCoreAddress: '0x0000000000000000000000000000000000000001',
    });

    const capabilities = service.getCapabilities();

    expect(capabilities.finalization.organization).toEqual({
      status: ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Supported,
      supportedFunctions: [
        ...ORGANIZATION_FINALIZATION_CONTRACT_FUNCTION_NAME_VALUES,
      ],
    });
    expect(capabilities.finalization.emergencyRecovery.status).toBe(
      ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported,
    );
    expect(capabilities.protocol.sources.organizationFinalization).toBe(
      'contract_address_presence',
    );
  });

  it('does not claim finalization support when deployment evidence is missing', () => {
    expect(
      createService().getCapabilities().finalization.organization.status,
    ).toBe(ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unknown);
    expect(
      createService({ protocolProfile: 'current' }).getCapabilities()
        .finalization.organization.status,
    ).toBe(ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unknown);
  });

  it('allows explicit deployment metadata to represent older unsupported deployments', () => {
    expect(
      createService({
        deploymentCapabilities: {
          contractBatchActivation: 'unsupported',
          organizationFinalization: 'unsupported',
        },
      }).getCapabilities().finalization.organization.status,
    ).toBe(ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported);
  });
});

function createService(
  options: Partial<{
    readonly protocolProfile: IsoniaProtocolProfile;
    readonly deploymentCapabilities: DeploymentCapabilitiesConfig;
    readonly govCoreAddress: `0x${string}`;
    readonly govProposalsAddress: `0x${string}`;
  }> &
    Partial<AppConfigService> = {},
): ActivationCapabilitiesService {
  const config = {
    chainId: 31337,
    protocolProfile: options.protocolProfile,
    deploymentCapabilities: options.deploymentCapabilities ?? {},
    contracts: {
      govCoreAddress: options.govCoreAddress,
      govProposalsAddress: options.govProposalsAddress,
    },
    ...options,
  } as unknown as AppConfigService;
  return new ActivationCapabilitiesService(config);
}
