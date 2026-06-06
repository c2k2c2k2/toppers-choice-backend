import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AdminFilesController } from './admin-files.controller';
import { AssetsController } from './assets.controller';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PublicAssetsController } from './public-assets.controller';

@Module({
  imports: [AuthorizationModule],
  controllers: [
    AdminFilesController,
    PublicAssetsController,
    AssetsController,
    FilesController,
  ],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
