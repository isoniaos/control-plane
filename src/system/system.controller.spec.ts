import { Test, TestingModule } from '@nestjs/testing';
import {
  ActivationCapabilityStatus,
  ActivationExecutionMode,
} from '@isonia/types';
import { AppConfigService } from '../config/app-config.service';
import { ActivationCapabilitiesService } from './activation-capabilities.service';
import { SystemController } from './system.controller';

describe('SystemController', () => {
  let controller: SystemController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [AppConfigService, ActivationCapabilitiesService],
    }).compile();

    controller = module.get(SystemController);
  });

  it('returns health status', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('keeps the version response shape backward compatible', () => {
    expect(Object.keys(controller.getVersion())).toEqual([
      'service',
      'version',
      'chainId',
      'contracts',
    ]);
    expect(controller.getVersion()).toMatchObject({
      service: 'isonia-control-plane',
      chainId: 31337,
      contracts: {},
    });
  });

  it('returns activation capability metadata', () => {
    const capabilities = controller.getCapabilities();

    expect(typeof capabilities.generatedAt).toBe('string');
    expect(capabilities).toMatchObject({
      apiVersion: 'v1',
      chainId: 31337,
      activation: {
        availableModes: [ActivationExecutionMode.Serial],
        flags: {
          serial: true,
          contractBatch: false,
          walletBatchEip5792: false,
        },
        contractBatch: {
          status: ActivationCapabilityStatus.Unknown,
          supportedFunctions: [],
        },
        walletBatchEip5792: {
          status: ActivationCapabilityStatus.Unsupported,
          standard: 'eip5792',
        },
      },
    });
  });
});
