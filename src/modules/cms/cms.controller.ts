import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CmsService } from './cms.service';
import {
  CmsPageResponseDto,
  CmsResolveResponseDto,
} from './dto/cms-response.dto';

@ApiTags('cms')
@ApiBearerAuth('access-token')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('student/resolve')
  @ApiOkResponse({ type: CmsResolveResponseDto })
  async resolveStudentCms(@CurrentUser() user: AuthenticatedUser) {
    return this.cmsService.resolveStudentCms(user.siteId);
  }

  @Get('student/pages/:slug')
  @ApiOkResponse({ type: CmsPageResponseDto })
  async getStudentPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.cmsService.getStudentPage(user.siteId, slug);
  }
}
