import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMyProfileDto {
  @ApiProperty({ example: 'Updated Student Name' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
}
