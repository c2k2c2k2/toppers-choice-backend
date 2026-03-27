import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SecuritySignalSeverity } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListNoteSecuritySignalsQueryDto {
  @ApiPropertyOptional({ enum: SecuritySignalSeverity })
  @IsOptional()
  @IsEnum(SecuritySignalSeverity)
  severity?: SecuritySignalSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noteId?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}
