import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import {
  ActivationCapabilitiesService,
  type ControlPlaneCapabilitiesDto,
} from './activation-capabilities.service';
import { readServiceVersion } from './version';

@Controller('v1')
export class SystemController {
  constructor(
    private readonly config: AppConfigService,
    private readonly capabilities: ActivationCapabilitiesService,
  ) {}

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

  @Get('capabilities')
  getCapabilities(): ControlPlaneCapabilitiesDto {
    return this.capabilities.getCapabilities();
  }
}
