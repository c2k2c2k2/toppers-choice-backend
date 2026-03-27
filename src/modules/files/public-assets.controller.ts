import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { FilesService } from './files.service';

@ApiTags('public-assets')
@Controller('public/assets')
export class PublicAssetsController {
  constructor(private readonly filesService: FilesService) {}

  @Public()
  @Get(':assetId')
  @ApiOkResponse({
    description: 'Streams a public asset through the backend.',
  })
  async streamPublicAsset(
    @Param('assetId') assetId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.filesService.streamPublicAsset(assetId, response);
  }
}
