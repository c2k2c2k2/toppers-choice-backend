import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileAssetPurpose } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  FileAssetResponseDto,
  InitFileUploadResponseDto,
} from './dto/file-asset-response.dto';
import { InitFileUploadDto } from './dto/manage-file-assets.dto';
import { FilesService } from './files.service';

const SELF_SERVICE_FILE_PURPOSES = new Set<FileAssetPurpose>([
  FileAssetPurpose.PROFILE_IMAGE,
  FileAssetPurpose.FEEDBACK_ATTACHMENT,
]);

@ApiTags('files')
@ApiBearerAuth('access-token')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('init-upload')
  @ApiCreatedResponse({ type: InitFileUploadResponseDto })
  async initUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InitFileUploadDto,
  ) {
    if (!SELF_SERVICE_FILE_PURPOSES.has(body.purpose)) {
      throw new BadRequestException({
        code: 'FILE_PURPOSE_NOT_ALLOWED',
        message: 'This upload purpose is not available for self-service upload.',
      });
    }

    return this.filesService.initUpload(user, body);
  }

  @Post(':assetId/confirm-upload')
  @ApiOkResponse({ type: FileAssetResponseDto })
  async confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assetId') assetId: string,
  ) {
    return this.filesService.confirmUpload(user.siteId, user.userId, assetId);
  }
}
