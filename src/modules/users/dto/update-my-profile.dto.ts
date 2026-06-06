import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const INDIAN_MOBILE_PATTERN = /^(?:\+91)?[6-9]\d{9}$/;

export class UpdateMyProfileDto {
  @ApiProperty({ example: 'Updated Student Name' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ example: 'student@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/[\s()-]/gu, '') : value,
  )
  @IsOptional()
  @IsString()
  @Matches(INDIAN_MOBILE_PATTERN, {
    message:
      'Mobile number must be a valid Indian number with optional +91 prefix.',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'cmag4file001', nullable: true })
  @IsOptional()
  @IsString()
  profileImageFileAssetId?: string | null;
}
