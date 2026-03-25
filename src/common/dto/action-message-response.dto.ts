import { ApiProperty } from '@nestjs/swagger';

export class ActionMessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;
}
