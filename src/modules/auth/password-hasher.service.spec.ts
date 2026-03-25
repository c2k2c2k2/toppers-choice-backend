import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(() => {
    service = new PasswordHasherService();
  });

  it('hashes and verifies passwords', async () => {
    const password = 'StudyHard@123';
    const hash = await service.hash(password);

    expect(hash).not.toBe(password);
    await expect(service.verify(password, hash)).resolves.toBe(true);
    await expect(service.verify('WrongPassword@123', hash)).resolves.toBe(
      false,
    );
  });
});
