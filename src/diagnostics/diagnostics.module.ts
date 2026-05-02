import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { RuntimeHeartbeatService } from './runtime-heartbeat.service';

@Module({
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService, RuntimeHeartbeatService],
  exports: [DiagnosticsService, RuntimeHeartbeatService],
})
export class DiagnosticsModule {}
