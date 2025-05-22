import type { Generated } from 'kysely';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export interface UserTable {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  preferred_language: string;
  created_at: Date;
  updated_at: Date;
}

export interface TimeEntryTable {
  id: string;
  user_id: string;
  date: Date;
  travel_start_time?: string;
  work_start_time: string;
  work_end_time: string;
  break_start_time?: string;
  break_end_time?: string;
  travel_end_time?: string;
  extra_time?: string;
  comments?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SettingsTable {
  id: string;
  user_id?: string;
  normal_work_time: string;
  summer_work_time: string;
}

export interface BreakTable {
  id: string;
  time_entry_id: string;
  break_start_time: string;
  break_end_time: string;
}

export interface DB {
  user: UserTable;
  time_entry: TimeEntryTable;
  settings: SettingsTable;
  break: BreakTable;
}

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});
