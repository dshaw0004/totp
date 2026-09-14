import {Database} from 'bun:sqlite';
import {homedir} from "os";
import {join} from "path";

export interface Account {id: string; name: string; issuer: string;}
export interface FullAccount {
  id: Number;
  name: string;
  issuer: string;
  secret_b32: string;
  algorithm: string;
  digits: number;
  otp_type: 'TOTP' | 'HOTP';
  counter: number;
}


const dbPath = join(homedir(), ".gauth_vault/accounts.db")
const db = new Database(dbPath, {create: true})

export const accounts: Array<Account> = db.query(`select id, name, issuer from accounts limit 10;`).all() as Array<Account>;

export function getAccountById(id: number): FullAccount {
  return db.query(`select * from accounts where id = ${id};`).get() as FullAccount
}
export function closeDb() {
  db.close()
}
export function applyMigration() {
  const schema = `
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    issuer TEXT,
    secret_b32 TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'SHA1',
    digits INTEGER NOT NULL DEFAULT 6,
    otp_type TEXT NOT NULL DEFAULT 'TOTP',
    counter INTEGER NOT NULL DEFAULT 0,
    UNIQUE(name, issuer, secret_b32)
  );
  `
  db.query(schema).run()
}
