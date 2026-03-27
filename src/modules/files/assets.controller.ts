import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { FilesService } from './files.service';

@ApiTags('assets')
@ApiBearerAuth('access-token')
@Controller('assets')
export class AssetsController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':assetId')
  @ApiOkResponse({
    description:
      'Streams an authenticated or protected asset through the backend.',
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async streamProtectedAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assetId') assetId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.filesService.streamProtectedAsset(assetId, user, response);
  }
}
