import { Controller, Get } from '@nestjs/common';
import {
  DiagnosticsService,
  type ControlPlaneDiagnosticsDto,
  type IndexerDiagnosticsDto,
} from './diagnostics.service';

@Controller('v1')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get('diagnostics')
  getDiagnostics(): Promise<ControlPlaneDiagnosticsDto> {
    return this.diagnostics.getDiagnostics();
  }

  @Get('diagnostics/indexer')
  getIndexerDiagnostics(): Promise<IndexerDiagnosticsDto> {
    return this.diagnostics.getIndexerDiagnostics();
  }
}
