import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ISONIA_CORE_ADDRESS;
    delete process.env.ISONIA_PROPOSALS_ADDRESS;
    delete process.env.GOV_CORE_ADDRESS;
    delete process.env.GOV_PROPOSALS_ADDRESS;
    delete process.env.ISONIA_PROTOCOL_PROFILE;
    delete process.env.ISONIA_DEPLOYMENT_CAPABILITIES_JSON;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('treats blank contract addresses as unconfigured', () => {
    process.env.ISONIA_CORE_ADDRESS = '';
    process.env.ISONIA_PROPOSALS_ADDRESS = '';

    const config = new AppConfigService();

    expect(config.contracts.isoCoreAddress).toBeUndefined();
    expect(config.contracts.isoProposalsAddress).toBeUndefined();
    expect(config.contractAddresses).toEqual([]);
  });

  it('parses configured Isonia protocol contract addresses', () => {
    process.env.ISONIA_CORE_ADDRESS =
      '0x0000000000000000000000000000000000000001';
    process.env.ISONIA_PROPOSALS_ADDRESS =
      '0x0000000000000000000000000000000000000002';

    const config = new AppConfigService();

    expect(config.contracts).toEqual({
      isoCoreAddress: '0x0000000000000000000000000000000000000001',
      isoProposalsAddress: '0x0000000000000000000000000000000000000002',
    });
    expect(config.contractAddresses).toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
    ]);
  });

  it('rejects zero-address contract placeholders', () => {
    process.env.ISONIA_CORE_ADDRESS =
      '0x0000000000000000000000000000000000000000';

    expect(() => new AppConfigService()).toThrow(
      'Zero address is not valid for environment variable: ISONIA_CORE_ADDRESS',
    );
  });

  it('rejects malformed contract addresses', () => {
    process.env.ISONIA_PROPOSALS_ADDRESS = '0x1234';

    expect(() => new AppConfigService()).toThrow(
      'Invalid address environment variable: ISONIA_PROPOSALS_ADDRESS',
    );
  });

  it('does not treat old GOV_* variables as active aliases', () => {
    process.env.GOV_CORE_ADDRESS =
      '0x0000000000000000000000000000000000000001';
    process.env.GOV_PROPOSALS_ADDRESS =
      '0x0000000000000000000000000000000000000002';

    const config = new AppConfigService();

    expect(config.contracts).toEqual({});
    expect(config.contractAddresses).toEqual([]);
  });

  it('treats blank protocol profile and deployment capabilities as unknown metadata', () => {
    process.env.ISONIA_PROTOCOL_PROFILE = '';
    process.env.ISONIA_DEPLOYMENT_CAPABILITIES_JSON = '';

    const config = new AppConfigService();

    expect(config.protocolProfile).toBeUndefined();
    expect(config.deploymentCapabilities).toEqual({});
  });

  it('parses explicit deployment capability metadata', () => {
    process.env.ISONIA_PROTOCOL_PROFILE = 'current';
    process.env.ISONIA_DEPLOYMENT_CAPABILITIES_JSON =
      '{"activation":{"contractBatch":true},"finalization":{"organization":"unsupported"},"execution":{"permissionRegistry":true}}';

    const config = new AppConfigService();

    expect(config.protocolProfile).toBe('current');
    expect(config.deploymentCapabilities).toEqual({
      contractBatchActivation: 'supported',
      organizationFinalization: 'unsupported',
      executionPermissionRegistry: 'supported',
    });
  });

  it('rejects unknown protocol profiles', () => {
    process.env.ISONIA_PROTOCOL_PROFILE = 'v0.8.0-alpha.1';

    expect(() => new AppConfigService()).toThrow(
      'Invalid ISONIA_PROTOCOL_PROFILE',
    );
  });

  it('rejects malformed deployment capability metadata', () => {
    process.env.ISONIA_DEPLOYMENT_CAPABILITIES_JSON = '{not-json';

    expect(() => new AppConfigService()).toThrow(
      'Invalid JSON environment variable: ISONIA_DEPLOYMENT_CAPABILITIES_JSON',
    );
  });
});
