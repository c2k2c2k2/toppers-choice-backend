import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class ResolveSiteBootstrapQueryDto {
  @ApiPropertyOptional({
    description: 'Optional site code for future multi-site lookups.',
    example: 'toppers-choice',
  })
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  siteCode?: string;
}
