import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_ALGORITHM = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;

@Injectable()
export class PasswordHasherService {
  async hash(value: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(value, salt, SCRYPT_KEY_LENGTH)) as Buffer;

    return `${PASSWORD_HASH_ALGORITHM}$${salt}$${derivedKey.toString('hex')}`;
  }

  async verify(value: string, storedHash: string) {
    const [algorithm, salt, hash] = storedHash.split('$');
    if (
      algorithm !== PASSWORD_HASH_ALGORITHM ||
      !salt ||
      !hash ||
      hash.length === 0
    ) {
      return false;
    }

    const expected = Buffer.from(hash, 'hex');
    const derivedKey = (await scrypt(value, salt, expected.length)) as Buffer;

    if (derivedKey.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, expected);
  }
}
