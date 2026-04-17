import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { OssService }  from './oss.service';

@Module({
  controllers: [FileController],
  providers:   [FileService, OssService],
  exports:     [FileService, OssService],
})
export class FileModule {}
