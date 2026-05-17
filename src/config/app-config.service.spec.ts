import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOV_CORE_ADDRESS;
    delete process.env.GOV_PROPOSALS_ADDRESS;
    delete process.env.ISONIA_PROTOCOL_PROFILE;
    delete process.env.ISONIA_DEPLOYMENT_CAPABILITIES_JSON;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('treats blank contract addresses as unconfigured', () => {
    process.env.GOV_CORE_ADDRESS = '';
    process.env.GOV_PROPOSALS_ADDRESS = '';

    const config = new AppConfigService();

    expect(config.contracts.govCoreAddress).toBeUndefined();
    expect(config.contracts.govProposalsAddress).toBeUndefined();
    expect(config.contractAddresses).toEqual([]);
  });

  it('rejects zero-address contract placeholders', () => {
    process.env.GOV_CORE_ADDRESS = '0x0000000000000000000000000000000000000000';

    expect(() => new AppConfigService()).toThrow(
      'Zero address is not valid for environment variable: GOV_CORE_ADDRESS',
    );
  });

  it('rejects malformed contract addresses', () => {
    process.env.GOV_CORE_ADDRESS = '0x1234';

    expect(() => new AppConfigService()).toThrow(
      'Invalid address environment variable: GOV_CORE_ADDRESS',
    );
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
      '{"activation":{"contractBatch":true},"finalization":{"organization":"unsupported"}}';

    const config = new AppConfigService();

    expect(config.protocolProfile).toBe('current');
    expect(config.deploymentCapabilities).toEqual({
      contractBatchActivation: 'supported',
      organizationFinalization: 'unsupported',
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
