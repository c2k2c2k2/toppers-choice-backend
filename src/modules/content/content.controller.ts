import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ContentService } from './content.service';
import { ListPublishedContentQueryDto } from './dto/manage-content.dto';
import {
  ContentDetailResponseDto,
  ContentListResponseDto,
} from './dto/content-response.dto';

@ApiTags('content')
@ApiBearerAuth('access-token')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @ApiOkResponse({ type: ContentListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listContent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPublishedContentQueryDto,
  ) {
    return this.contentService.listPublishedContent(user, query);
  }

  @Get(':slug')
  @ApiOkResponse({ type: ContentDetailResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.contentService.getPublishedContentBySlug(user, slug);
  }
}
