import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import {
  PublicListContentQueryDto,
  ResolvePublicContentQueryDto,
} from './dto/manage-content.dto';
import {
  ContentDetailResponseDto,
  ContentListResponseDto,
} from './dto/content-response.dto';
import { ContentService } from './content.service';

@ApiTags('public-content')
@Controller('public/content')
export class PublicContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: ContentListResponseDto })
  async listContent(@Query() query: PublicListContentQueryDto) {
    return this.contentService.listPublicContent(query);
  }

  @Public()
  @Get(':slug')
  @ApiOkResponse({ type: ContentDetailResponseDto })
  async getContent(
    @Param('slug') slug: string,
    @Query() resolveQuery: ResolvePublicContentQueryDto,
  ) {
    return this.contentService.getPublicContentBySlug(slug, resolveQuery);
  }
}
