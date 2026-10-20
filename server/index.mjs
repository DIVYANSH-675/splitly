import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './core.mjs';
export function createApp({database = process.env.SPLITLY_DB || process.env.MEMOGO_DB || resolve('data/memogo.sqlite'), connection, googleAuth, allowLegacyAuth = false} = {}) {
  if (database !== ':memory:') mkdirSync(dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS backup_emails(user_id TEXT PRIMARY KEY REFERENCES users(id),email TEXT UNIQUE NOT NULL,verified_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS email_challenges(user_id TEXT PRIMARY KEY REFERENCES users(id),email TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_identities(provider TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),email TEXT NOT NULL,PRIMARY KEY(provider,subject),UNIQUE(user_id,provider));
    CREATE TABLE IF NOT EXISTS operations(user_id TEXT NOT NULL,request_id TEXT NOT NULL,path TEXT NOT NULL,signature TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(user_id,request_id));
    CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),username TEXT UNIQUE NOT NULL,photo TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,trip_id TEXT NOT NULL,user_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,data TEXT NOT NULL);
  `);
  const handler = createHandler(connection || db, new Map(), googleAuth, { allowLegacyAuth });
  let writes = Promise.resolve();
  const server = http.createServer((req,res) => {
    // Serialize complete requests so async hashing never loses a concurrent group update.
    writes = writes.catch(() => {}).then(() => handler(req,res));
  });
  return {server, db};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createApp();
  const port = Number(process.env.PORT || 4310);
  server.listen(port,'0.0.0.0',() => console.log(`SplitBill API listening on http://localhost:${port}`));
}
