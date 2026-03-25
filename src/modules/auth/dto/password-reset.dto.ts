import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class PasswordResetDto {
  @ApiProperty({ example: 'student@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: '483921' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  code!: string;

  @ApiProperty({ example: 'NewSecurePassword@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
