import {
  ActivationCapabilityStatus,
  ActivationExecutionMode,
  ADMIN_BATCH_ACTIVATION_FUNCTION_NAME_VALUES,
  ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES,
  ORGANIZATION_FINALIZATION_CONTRACT_FUNCTION_NAME_VALUES,
} from '@isonia/types';
import { AppConfigService } from '../config/app-config.service';
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

  it('reports v0.7 typed contract batch activation support from configured contract version', () => {
    const service = createService('v0.7.0-alpha.1');

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

  it.each(['v0.7.0-alpha.2', 'evm-contracts@v0.7.0-alpha.3'])(
    'keeps typed contract batch activation support for %s',
    (version) => {
      const service = createService(version);

      const capabilities = service.getActivationCapabilities();

      expect(capabilities.flags.contractBatch).toBe(true);
      expect(capabilities.contractBatch.status).toBe(
        ActivationCapabilityStatus.Supported,
      );
    },
  );

  it('does not report EIP-5792 as a primary or available activation mode', () => {
    const service = createService('evm-contracts@v0.7.0-alpha.1');

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
    const service = createService('v0.7.0-alpha.1', {
      rpcUrl: 'https://example.invalid/rpc?token=secret-rpc-token',
      databaseUrl: 'postgres://postgres:secret-db-pass@localhost/control-plane',
    });

    const serialized = JSON.stringify(service.getCapabilities());

    expect(serialized).not.toContain('secret-rpc-token');
    expect(serialized).not.toContain('secret-db-pass');
    expect(serialized).not.toContain('postgres://');
  });

  it('reports finalization as unsupported for v0.7.0-alpha.1 contract deployments', () => {
    const service = createService('v0.7.0-alpha.1');

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

  it.each(['v0.7.0-alpha.2', 'evm-contracts@v0.7.0-alpha.3'])(
    'reports finalization as supported for %s contract deployments',
    (version) => {
      const service = createService(version);

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
    },
  );

  it.each(['0.8.0-alpha.1', 'v0.8.0-alpha.1', 'evm-contracts@v0.8.0-alpha.1'])(
    'carries v0.7 activation and finalization support into %s',
    (version) => {
      const service = createService(version);

      const capabilities = service.getCapabilities();

      expect(capabilities.activation.flags.contractBatch).toBe(true);
      expect(capabilities.activation.flags.walletBatchEip5792).toBe(false);
      expect(capabilities.finalization.organization.status).toBe(
        ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Supported,
      );
    },
  );

  it('does not claim finalization support for unknown or older contract deployments', () => {
    expect(
      createService().getCapabilities().finalization.organization.status,
    ).toBe(ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unknown);
    expect(
      createService('v0.6.0-alpha.2').getCapabilities().finalization
        .organization.status,
    ).toBe(ORGANIZATION_FINALIZATION_CAPABILITY_STATUSES.Unsupported);
  });
});

function createService(
  evmContractsVersion?: string,
  extraConfig: Partial<AppConfigService> = {},
): ActivationCapabilitiesService {
  const config = {
    chainId: 31337,
    evmContractsVersion,
    ...extraConfig,
  } as unknown as AppConfigService;
  return new ActivationCapabilitiesService(config);
}
