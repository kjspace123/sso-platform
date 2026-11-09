import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, standard for GCM

/**
 * Encrypts OAuth client secrets at rest (section 15/16). Unlike passwords
 * (Argon2id, one-way — see auth/password.service.ts), client secrets must be
 * recoverable: the token endpoint has to compare the actual value a
 * confidential client presents (client_secret_basic/post per RFC 6749),
 * which oidc-provider does via a constant-time string compare, not a hash
 * compare. Encryption-at-rest (rather than plaintext storage) is the
 * standard mitigation here.
 */
export class SecretCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new Error('SecretCipher key must be 32 bytes (base64-encoded)');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((buf) => buf.toString('base64url')).join('.');
  }

  decrypt(payload: string): string {
    const [ivPart, authTagPart, ciphertextPart] = payload.split('.');
    if (!ivPart || !authTagPart || !ciphertextPart) {
      throw new Error('Malformed ciphertext payload');
    }
    const iv = Buffer.from(ivPart, 'base64url');
    const authTag = Buffer.from(authTagPart, 'base64url');
    const ciphertext = Buffer.from(ciphertextPart, 'base64url');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
