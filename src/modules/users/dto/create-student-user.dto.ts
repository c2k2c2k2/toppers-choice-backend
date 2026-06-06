import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const INDIAN_MOBILE_PATTERN = /^(?:\+91)?[6-9]\d{9}$/;

export class CreateStudentUserDto {
  @ApiProperty({ example: 'Batch Student' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'batch-student@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: '+919876543210' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/[\s()-]/gu, '') : value,
  )
  @IsString()
  @Matches(INDIAN_MOBILE_PATTERN, {
    message:
      'Mobile number must be a valid Indian number with optional +91 prefix.',
  })
  phone!: string;

  @ApiProperty({ example: 'StudentPassword@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
