import { ApiProperty } from '@nestjs/swagger';
import { UserIdentityResponseDto } from './user-identity-response.dto';

export class AdminUsersListResponseDto {
  @ApiProperty({ type: [UserIdentityResponseDto] })
  items!: UserIdentityResponseDto[];

  @ApiProperty()
  total!: number;
}
