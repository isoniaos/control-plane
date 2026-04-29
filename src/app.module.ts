import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { IndexerModule } from './indexer/indexer.module';
import { ProjectionsModule } from './projections/projections.module';
import { ReadModelsModule } from './read-models/read-models.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    DiagnosticsModule,
    IndexerModule,
    ProjectionsModule,
    ReadModelsModule,
    SystemModule,
  ],
})
export class AppModule {}
