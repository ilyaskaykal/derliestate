import { supabase } from './supabase';

const ATTEMPTS_KEY = 'de_failed_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

function getAttempts(): Record<string, AttemptRecord> {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAttempts(data: Record<string, AttemptRecord>) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
}

export function handleFailedAttempt(username: string): void {
  const attempts = getAttempts();
  const rec = attempts[username] || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    rec.count = 0;
  }
  attempts[username] = rec;
  saveAttempts(attempts);
}

export function checkLockout(username: string): string | null {
  const attempts = getAttempts();
  const rec = attempts[username];
  if (rec?.lockedUntil > Date.now()) {
    const remaining = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
    return `Çok fazla başarısız deneme. ${remaining} dakika sonra tekrar deneyin.`;
  }
  return null;
}

export function clearFailedAttempts(username: string): void {
  const attempts = getAttempts();
  delete attempts[username];
  saveAttempts(attempts);
}

const ACTIVITY_KEY = 'de_last_activity';
export const SESSION_DURATION = 24 * 60 * 60 * 1000;

export function touchActivity(): void {
  localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
}

export function isSessionExpired(): boolean {
  const last = localStorage.getItem(ACTIVITY_KEY);
  if (!last) return false;
  return Date.now() - parseInt(last) > SESSION_DURATION;
}

export async function logAction(
  userUsername: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      user_username: userUsername,
      action,
      details: details ?? null,
      ip_address: 'browser',
    });
  } catch {
    // non-fatal
  }
}

export function sanitizeInput(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, '');
}

export function validatePhone(phone: string): boolean {
  return /^\+90\d{10}$/.test(phone);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
