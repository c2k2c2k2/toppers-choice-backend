import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'Aarohi Patil' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'student@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'StudyHard@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
