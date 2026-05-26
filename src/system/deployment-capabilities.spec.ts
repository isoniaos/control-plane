import {
  IsoniaProtocolProfile,
  resolveContractBatchActivationCapability,
  resolveExecutionPermissionRegistryCapability,
} from './deployment-capabilities';

describe('deployment capability resolution', () => {
  it('resolves current IsoCore capability from profile and address evidence', () => {
    expect(
      resolveContractBatchActivationCapability({
        protocolProfile: IsoniaProtocolProfile.Current,
        deploymentCapabilities: {},
        contracts: {
          isoCoreAddress: '0x0000000000000000000000000000000000000001',
        },
      }),
    ).toEqual({
      status: 'supported',
      source: 'contract_address_presence',
      reason:
        'Contract batch activation is enabled by the current protocol profile and configured IsoCore address.',
    });
  });

  it('uses the active ISONIA env var name when IsoCore evidence is missing', () => {
    expect(
      resolveContractBatchActivationCapability({
        protocolProfile: IsoniaProtocolProfile.Current,
        deploymentCapabilities: {},
        contracts: {},
      }),
    ).toEqual({
      status: 'unknown',
      source: 'contract_address_presence',
      reason:
        'Contract batch activation cannot be proven because ISONIA_CORE_ADDRESS is not configured.',
    });
  });

  it('resolves current IsoProposals capability from profile and address evidence', () => {
    expect(
      resolveExecutionPermissionRegistryCapability({
        protocolProfile: IsoniaProtocolProfile.Current,
        deploymentCapabilities: {},
        contracts: {
          isoProposalsAddress: '0x0000000000000000000000000000000000000002',
        },
      }),
    ).toEqual({
      status: 'supported',
      source: 'contract_address_presence',
      reason:
        'Execution permission registry is enabled by the current protocol profile and configured IsoProposals address.',
    });
  });

  it('uses the active ISONIA env var name when IsoProposals evidence is missing', () => {
    expect(
      resolveExecutionPermissionRegistryCapability({
        protocolProfile: IsoniaProtocolProfile.Current,
        deploymentCapabilities: {},
        contracts: {},
      }),
    ).toEqual({
      status: 'unknown',
      source: 'contract_address_presence',
      reason:
        'Execution permission registry cannot be proven because ISONIA_PROPOSALS_ADDRESS is not configured.',
    });
  });
});
