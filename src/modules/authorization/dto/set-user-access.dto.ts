import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionOverrideInputDto {
  @ApiProperty({ example: 'admin.audit.read' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._-]+$/u)
  permissionKey!: string;

  @ApiProperty()
  @IsBoolean()
  isAllowed!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SetUserAccessDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) =>
          typeof item === 'string' ? item.trim() : item,
        )
      : value,
  )
  @IsString({ each: true })
  roleIds!: string[];

  @ApiPropertyOptional({ type: [PermissionOverrideInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideInputDto)
  permissionOverrides?: PermissionOverrideInputDto[];
}
