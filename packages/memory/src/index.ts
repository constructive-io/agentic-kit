import { logger, MemoryStore, AgentEvent, AgentState } from '@agentic-kit/core';

interface MockDatabase {
  exec(sql: string): void;
  prepare(sql: string): MockStatement;
  close(): void;
}

interface MockStatement {
  run(...params: any[]): { changes: number };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

class MockSQLiteDatabase implements MockDatabase {
  private data: Map<string, string> = new Map();

  exec(sql: string): void {
  }

  prepare(sql: string): MockStatement {
    return {
      run: (...params: any[]) => {
        if (sql.includes('INSERT OR REPLACE')) {
          this.data.set(params[0], params[1]);
        } else if (sql.includes('DELETE')) {
          const deleted = this.data.delete(params[0]);
          return { changes: deleted ? 1 : 0 };
        }
        return { changes: 1 };
      },
      get: (...params: any[]) => {
        const data = this.data.get(params[0]);
        return data ? { data } : undefined;
      },
      all: () => {
        return Array.from(this.data.keys()).map(key => ({ key }));
      }
    };
  }

  close(): void {
    this.data.clear();
  }
}

export class SQLiteMemoryStore implements MemoryStore {
  private db: MockDatabase;

  constructor(dbPath: string = ':memory:') {
    this.db = new MockSQLiteDatabase();
    this.initializeSchema();
    logger.info(`Initialized SQLiteMemoryStore at ${dbPath}`);
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async save(key: string, data: any): Promise<void> {
    const serialized = JSON.stringify(data);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory (key, data, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(key, serialized);
    logger.debug(`Saved data for key: ${key}`);
  }

  async load(key: string): Promise<any> {
    const stmt = this.db.prepare('SELECT data FROM memory WHERE key = ?');
    const row = stmt.get(key) as { data: string } | undefined;
    
    if (!row) {
      throw new Error(`No data found for key: ${key}`);
    }

    logger.debug(`Loaded data for key: ${key}`);
    return JSON.parse(row.data);
  }

  async delete(key: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM memory WHERE key = ?');
    const result = stmt.run(key);
    
    if (result.changes === 0) {
      throw new Error(`No data found for key: ${key}`);
    }

    logger.debug(`Deleted data for key: ${key}`);
  }

  async list(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT key FROM memory ORDER BY updated_at DESC');
    const rows = stmt.all() as { key: string }[];
    return rows.map(row => row.key);
  }

  close(): void {
    this.db.close();
    logger.info('SQLiteMemoryStore closed');
  }
}

export * from './conversation-memory';
