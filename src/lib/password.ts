import bcrypt from "bcryptjs";

// bcrypt silently truncates input past 72 bytes — enforced in validations/auth.ts too,
// but capped here as well since this helper could be called from elsewhere later.
const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
