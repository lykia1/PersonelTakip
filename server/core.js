import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
export const branch = Object.freeze({ name: 'Döner Atölyesi · Merkez', latitude: 40.209634, longitude: 28.978217, radius: 100 });
export const token = () => randomBytes(32).toString('hex');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(value) { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(value, salt, 64).toString('hex'); }
export function passwordMatches(value, stored) { const [salt, encoded] = stored.split(':'); return timingSafeEqual(scryptSync(value, salt, 64), Buffer.from(encoded, 'hex')); }
export function distance(lat, lon) {
  const rad = x => x * Math.PI / 180;
  const a = Math.sin(rad(lat - branch.latitude) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(branch.latitude)) * Math.sin(rad(lon - branch.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function validateLocation(location, now = Date.now()) {
  if (location.mocked) throw Object.assign(new Error('Sahte konum kabul edilmez.'), {status:400});
  if (Math.abs(now - location.timestamp) > 60000) throw Object.assign(new Error('Konum güncel değil. Tekrar dene.'), {status:400});
  if (location.accuracy > 50) throw Object.assign(new Error('Konum doğruluğu yetersiz. Açık alanda tekrar dene.'), {status:400});
  const meters = distance(location.latitude, location.longitude);
  // Require the uncertainty circle to fit inside the permitted perimeter.
  if (meters + location.accuracy > branch.radius) throw Object.assign(new Error('Dükkânın 100 metre sınırı içinde olmalısın.'), {status:400});
  return Math.round(meters);
}
export function openDatabase(folder) {
  mkdirSync(folder, { recursive: true });
  const db = new DatabaseSync(resolve(folder, 'attendance.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','employee','kiosk')), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges(token_hash TEXT PRIMARY KEY, kiosk_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), challenge_hash TEXT NOT NULL, expires INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('in','out')), created INTEGER NOT NULL, photo BLOB NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL NOT NULL, distance INTEGER NOT NULL, request_key TEXT NOT NULL, attempt_hash TEXT NOT NULL UNIQUE, UNIQUE(user_id, request_key));
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor INTEGER NOT NULL, action TEXT NOT NULL, created INTEGER NOT NULL);
  `);
  return db;
}
