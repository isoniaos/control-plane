import { Module } from '@nestjs/common';
import { ReadModelsController } from './read-models.controller';
import { ReadModelsService } from './read-models.service';

@Module({
  controllers: [ReadModelsController],
  providers: [ReadModelsService],
  exports: [ReadModelsService],
})
export class ReadModelsModule {}
