import { describe, expect, it } from 'vitest';
import { isEmail } from './profiles';

describe('isEmail', () => {
  it('accepte le sous-adressage avec +', () => {
    expect(isEmail('jean+pixel@gmail.com')).toBe(true);
    expect(isEmail('a.b+c.d+e@sub.domain.co')).toBe(true);
  });

  it('accepte les emails courants', () => {
    expect(isEmail('floriane.julliard@gmail.com')).toBe(true);
    expect(isEmail('user_name@example.io')).toBe(true);
  });

  it('rejette les saisies manifestement invalides', () => {
    expect(isEmail('pasdemail')).toBe(false);
    expect(isEmail('no@dot')).toBe(false);
    expect(isEmail('two @spaces.com')).toBe(false);
    expect(isEmail('@nolocal.com')).toBe(false);
  });
});
