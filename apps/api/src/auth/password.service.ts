import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Argon2id password hashing (section 6.8). Never store or log raw passwords. */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
