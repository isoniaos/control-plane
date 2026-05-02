import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { readServiceVersion } from './version';

@Controller('v1')
export class SystemController {
  constructor(private readonly config: AppConfigService) {}

  @Get('health')
  getHealth(): Record<string, string> {
    return { status: 'ok' };
  }

  @Get('version')
  getVersion(): Record<string, unknown> {
    return {
      service: 'isonia-control-plane',
      version: readServiceVersion(),
      chainId: this.config.chainId,
      contracts: this.config.contracts,
    };
  }
}
