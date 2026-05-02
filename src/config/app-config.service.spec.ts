import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOV_CORE_ADDRESS;
    delete process.env.GOV_PROPOSALS_ADDRESS;
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
});
