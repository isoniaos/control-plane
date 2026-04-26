import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../config/app-config.service';
import { SystemController } from './system.controller';

describe('SystemController', () => {
  let controller: SystemController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [AppConfigService],
    }).compile();

    controller = module.get(SystemController);
  });

  it('returns health status', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });
});
