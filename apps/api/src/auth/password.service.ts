import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Argon2id password hashing (section 6.8). Never store or log raw passwords. */
@Injectable()
export class PasswordService {
  // Lazily computed once and cached for the process lifetime — used to keep
  // "unknown email" and "wrong password" login responses indistinguishable
  // by timing (see verifyOrDummy below). Never a real credential.
  private dummyHashPromise: Promise<string> | null = null;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }

  /**
   * Same as verify(), but when there's no real hash to check against (e.g.
   * the account doesn't exist), still runs a full Argon2id verification
   * against a fixed dummy hash so the response takes comparable time either
   * way — otherwise the "no such user" path returns measurably faster than
   * the "wrong password" path, letting an attacker enumerate valid emails
   * via response latency even though both return the same error message.
   */
  async verifyOrDummy(hash: string | null | undefined, plain: string): Promise<boolean> {
    if (hash) return argon2.verify(hash, plain);
    await argon2.verify(await this.getDummyHash(), plain);
    return false;
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = argon2.hash('timing-equalization-placeholder', {
        type: argon2.argon2id,
      });
    }
    return this.dummyHashPromise;
  }
}
