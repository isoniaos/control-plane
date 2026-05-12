import { Module } from '@nestjs/common';
import { ActivationCapabilitiesService } from './activation-capabilities.service';
import { SystemController } from './system.controller';

@Module({
  controllers: [SystemController],
  providers: [ActivationCapabilitiesService],
})
export class SystemModule {}
