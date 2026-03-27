import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { CreateStudentUserDto } from './dto/create-student-user.dto';
import { UserIdentityResponseDto } from './dto/user-identity-response.dto';
import { mapUserIdentity } from './users.types';
import { UsersService } from './users.service';

@ApiTags('admin-users')
@ApiBearerAuth('access-token')
@Controller('admin/users/students')
export class AdminStudentsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasherService: PasswordHasherService,
  ) {}

  @Post()
  @Policy('admin.users.students.create')
  @Audit({
    action: 'admin.users.students.create',
    resourceType: 'user',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['fullName', 'email'],
  })
  @ApiCreatedResponse({ type: UserIdentityResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createStudent(@Body() body: CreateStudentUserDto) {
    const passwordHash = await this.passwordHasherService.hash(body.password);
    const user = await this.usersService.createStudentFromAdmin({
      email: body.email,
      fullName: body.fullName,
      passwordHash,
    });

    return mapUserIdentity(user);
  }
}
