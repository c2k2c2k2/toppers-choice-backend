import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

type ValidationIssue = {
  path: string;
  messages: string[];
};

export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors: ValidationError[] = []) =>
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: flattenValidationErrors(errors),
      }),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationIssue[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const issues: ValidationIssue[] = [];

    if (error.constraints) {
      issues.push({
        path,
        messages: Object.values(error.constraints),
      });
    }

    if (error.children?.length) {
      issues.push(...flattenValidationErrors(error.children, path));
    }

    return issues;
  });
}
