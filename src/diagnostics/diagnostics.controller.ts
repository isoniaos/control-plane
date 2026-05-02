import { Controller, Get } from '@nestjs/common';
import type { DiagnosticsDto } from '@isonia/types';
import {
  DiagnosticsService,
  type IndexerDiagnosticsDto,
} from './diagnostics.service';

@Controller('v1')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get('diagnostics')
  getDiagnostics(): Promise<DiagnosticsDto> {
    return this.diagnostics.getDiagnostics();
  }

  @Get('diagnostics/indexer')
  getIndexerDiagnostics(): Promise<IndexerDiagnosticsDto> {
    return this.diagnostics.getIndexerDiagnostics();
  }
}
