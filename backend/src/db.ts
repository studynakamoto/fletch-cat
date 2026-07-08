import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config, type CandleInterval } from "./config.js";
import { formatAddress } from "./utils.js";

export type TradeType = "buy" | "sell" | "swap_buy" | "swap_sell";

export interface TokenRow {
  address: string;
  curve_address: string;
  creator: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  twitter: string;
  telegram: string;
  website: string;
  index_num: number;
  graduated: number;
  pair_address: string | null;
  tokens_sold: string;
  sale_supply: string;
  total_supply: string;
  reserve_eth: string;
  reserve_token: string;
  price_eth: string;
  created_at: number;
  created_block: number;
}

export interface TradeRow {
  id: string;
  tx_hash: string;
  log_index: number;
  block_number: number;
  timestamp: number;
  token_address: string;
  trade_type: TradeType;
  trader_address: string;
  eth_amount: string;
  token_amount: string;
  price_eth: string;
}

export interface CandleRow {
  token_address: string;
  interval: CandleInterval;
  open_time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume_eth: string;
}

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  address TEXT PRIMARY KEY,
  curve_address TEXT NOT NULL UNIQUE,
  creator TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  twitter TEXT NOT NULL DEFAULT '',
  telegram TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  index_num INTEGER NOT NULL DEFAULT 0,
  graduated INTEGER NOT NULL DEFAULT 0,
  pair_address TEXT,
  tokens_sold TEXT NOT NULL DEFAULT '0',
  sale_supply TEXT NOT NULL DEFAULT '0',
  total_supply TEXT NOT NULL DEFAULT '0',
  reserve_eth TEXT NOT NULL DEFAULT '0',
  reserve_token TEXT NOT NULL DEFAULT '0',
  price_eth TEXT NOT NULL DEFAULT '0',
  created_at INTEGER NOT NULL DEFAULT 0,
  created_block INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tokens_graduated ON tokens(graduated);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at DESC);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  trader_address TEXT NOT NULL,
  eth_amount TEXT NOT NULL,
  token_amount TEXT NOT NULL,
  price_eth TEXT NOT NULL,
  UNIQUE(tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_trades_token_time ON trades(token_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_block ON trades(block_number);

CREATE TABLE IF NOT EXISTS candles (
  token_address TEXT NOT NULL,
  interval TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  open TEXT NOT NULL,
  high TEXT NOT NULL,
  low TEXT NOT NULL,
  close TEXT NOT NULL,
  volume_eth TEXT NOT NULL,
  PRIMARY KEY (token_address, interval, open_time)
);

CREATE TABLE IF NOT EXISTS holders (
  token_address TEXT NOT NULL,
  address TEXT NOT NULL,
  balance TEXT NOT NULL DEFAULT '0',
  PRIMARY KEY (token_address, address)
);

CREATE TABLE IF NOT EXISTS curve_map (
  curve_address TEXT PRIMARY KEY,
  token_address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pair_map (
  pair_address TEXT PRIMARY KEY,
  token_address TEXT NOT NULL
);
`;

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dir = path.dirname(config.databasePath);
  fs.mkdirSync(dir, { recursive: true });

  dbInstance = new Database(config.databasePath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.exec(MIGRATIONS);
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function resetDb(): void {
  closeDb();
  for (const file of [
    config.databasePath,
    `${config.databasePath}-wal`,
    `${config.databasePath}-shm`,
  ]) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.warn(`Could not delete ${file}:`, err);
      }
    }
  }
  getDb();
}

export function getLastIndexedBlock(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM indexer_state WHERE key = 'last_indexed_block'")
    .get() as { value: string } | undefined;
  if (!row) return config.startBlock - 1;
  return Number.parseInt(row.value, 10);
}

export function setLastIndexedBlock(block: number): void {
  getDb()
    .prepare(
      "INSERT INTO indexer_state(key, value) VALUES('last_indexed_block', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(String(block));
}

export interface UpsertTokenInput {
  address: string;
  curveAddress: string;
  creator: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  indexNum?: number;
  saleSupply?: bigint;
  totalSupply?: bigint;
  createdAt?: number;
  createdBlock?: number;
}

export function upsertToken(input: UpsertTokenInput): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO tokens (
      address, curve_address, creator, name, symbol, description, image,
      twitter, telegram, website, index_num, sale_supply, total_supply,
      created_at, created_block
    ) VALUES (
      @address, @curveAddress, @creator, @name, @symbol, @description, @image,
      @twitter, @telegram, @website, @indexNum, @saleSupply, @totalSupply,
      @createdAt, @createdBlock
    )
    ON CONFLICT(address) DO UPDATE SET
      name = excluded.name,
      symbol = excluded.symbol,
      description = excluded.description,
      image = excluded.image,
      twitter = excluded.twitter,
      telegram = excluded.telegram,
      website = excluded.website,
      index_num = excluded.index_num,
      sale_supply = CASE WHEN excluded.sale_supply != '0' THEN excluded.sale_supply ELSE tokens.sale_supply END,
      total_supply = CASE WHEN excluded.total_supply != '0' THEN excluded.total_supply ELSE tokens.total_supply END,
      created_at = CASE WHEN excluded.created_at > 0 THEN excluded.created_at ELSE tokens.created_at END,
      created_block = CASE WHEN excluded.created_block > 0 THEN excluded.created_block ELSE tokens.created_block END`,
  ).run({
    address: formatAddress(input.address),
    curveAddress: formatAddress(input.curveAddress),
    creator: formatAddress(input.creator),
    name: input.name,
    symbol: input.symbol,
    description: input.description ?? "",
    image: input.image ?? "",
    twitter: input.twitter ?? "",
    telegram: input.telegram ?? "",
    website: input.website ?? "",
    indexNum: input.indexNum ?? 0,
    saleSupply: (input.saleSupply ?? 0n).toString(),
    totalSupply: (input.totalSupply ?? 0n).toString(),
    createdAt: input.createdAt ?? 0,
    createdBlock: input.createdBlock ?? 0,
  });

  db.prepare(
    `INSERT INTO curve_map(curve_address, token_address) VALUES(?, ?)
     ON CONFLICT(curve_address) DO UPDATE SET token_address = excluded.token_address`,
  ).run(formatAddress(input.curveAddress), formatAddress(input.address));
}

export function mapCurveToToken(curveAddress: string, tokenAddress: string): void {
  getDb()
    .prepare(
      `INSERT INTO curve_map(curve_address, token_address) VALUES(?, ?)
       ON CONFLICT(curve_address) DO UPDATE SET token_address = excluded.token_address`,
    )
    .run(formatAddress(curveAddress), formatAddress(tokenAddress));
}

export function mapPairToToken(pairAddress: string, tokenAddress: string): void {
  getDb()
    .prepare(
      `INSERT INTO pair_map(pair_address, token_address) VALUES(?, ?)
       ON CONFLICT(pair_address) DO UPDATE SET token_address = excluded.token_address`,
    )
    .run(formatAddress(pairAddress), formatAddress(tokenAddress));
}

export function getTokenByCurve(curveAddress: string): string | null {
  const row = getDb()
    .prepare("SELECT token_address FROM curve_map WHERE curve_address = ?")
    .get(formatAddress(curveAddress)) as { token_address: string } | undefined;
  return row?.token_address ?? null;
}

export function getTokenByPair(pairAddress: string): string | null {
  const row = getDb()
    .prepare("SELECT token_address FROM pair_map WHERE pair_address = ?")
    .get(formatAddress(pairAddress)) as { token_address: string } | undefined;
  return row?.token_address ?? null;
}

export function getAllCurveAddresses(): string[] {
  const rows = getDb()
    .prepare("SELECT curve_address FROM curve_map")
    .all() as { curve_address: string }[];
  return rows.map((r) => r.curve_address);
}

export function getAllPairAddresses(): string[] {
  const rows = getDb()
    .prepare("SELECT pair_address FROM pair_map WHERE pair_address IS NOT NULL")
    .all() as { pair_address: string }[];
  return rows.map((r) => r.pair_address);
}

export function markGraduated(
  tokenAddress: string,
  pairAddress: string,
  reserveEth: bigint,
  reserveToken: bigint,
): void {
  const db = getDb();
  db.prepare(
    `UPDATE tokens SET
      graduated = 1,
      pair_address = ?,
      reserve_eth = ?,
      reserve_token = ?,
      tokens_sold = sale_supply
     WHERE address = ?`,
  ).run(
    formatAddress(pairAddress),
    reserveEth.toString(),
    reserveToken.toString(),
    formatAddress(tokenAddress),
  );
  mapPairToToken(pairAddress, tokenAddress);
}

export function updateTokenState(
  tokenAddress: string,
  fields: {
    tokensSold?: bigint;
    reserveEth?: bigint;
    reserveToken?: bigint;
    priceEth?: bigint;
    pairAddress?: string;
    graduated?: boolean;
  },
): void {
  const sets: string[] = [];
  const params: Record<string, string | number> = {
    address: formatAddress(tokenAddress),
  };

  if (fields.tokensSold !== undefined) {
    sets.push("tokens_sold = @tokensSold");
    params.tokensSold = fields.tokensSold.toString();
  }
  if (fields.reserveEth !== undefined) {
    sets.push("reserve_eth = @reserveEth");
    params.reserveEth = fields.reserveEth.toString();
  }
  if (fields.reserveToken !== undefined) {
    sets.push("reserve_token = @reserveToken");
    params.reserveToken = fields.reserveToken.toString();
  }
  if (fields.priceEth !== undefined) {
    sets.push("price_eth = @priceEth");
    params.priceEth = fields.priceEth.toString();
  }
  if (fields.pairAddress !== undefined) {
    sets.push("pair_address = @pairAddress");
    params.pairAddress = formatAddress(fields.pairAddress);
  }
  if (fields.graduated !== undefined) {
    sets.push("graduated = @graduated");
    params.graduated = fields.graduated ? 1 : 0;
  }

  if (sets.length === 0) return;

  getDb()
    .prepare(`UPDATE tokens SET ${sets.join(", ")} WHERE address = @address`)
    .run(params);
}

export function insertTrade(trade: {
  id: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  timestamp: number;
  tokenAddress: string;
  tradeType: TradeType;
  traderAddress: string;
  ethAmount: bigint;
  tokenAmount: bigint;
  priceEth: bigint;
}): boolean {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO trades (
        id, tx_hash, log_index, block_number, timestamp, token_address,
        trade_type, trader_address, eth_amount, token_amount, price_eth
      ) VALUES (
        @id, @txHash, @logIndex, @blockNumber, @timestamp, @tokenAddress,
        @tradeType, @traderAddress, @ethAmount, @tokenAmount, @priceEth
      )`,
    )
    .run({
      id: trade.id,
      txHash: trade.txHash,
      logIndex: trade.logIndex,
      blockNumber: trade.blockNumber,
      timestamp: trade.timestamp,
      tokenAddress: formatAddress(trade.tokenAddress),
      tradeType: trade.tradeType,
      traderAddress: formatAddress(trade.traderAddress),
      ethAmount: trade.ethAmount.toString(),
      tokenAmount: trade.tokenAmount.toString(),
      priceEth: trade.priceEth.toString(),
    });
  return result.changes > 0;
}

export function upsertCandle(
  tokenAddress: string,
  interval: CandleInterval,
  openTime: number,
  priceEth: bigint,
  volumeEth: bigint,
): void {
  const price = priceEth.toString();
  const volume = volumeEth.toString();
  const addr = formatAddress(tokenAddress);

  getDb()
    .prepare(
      `INSERT INTO candles (token_address, interval, open_time, open, high, low, close, volume_eth)
       VALUES (@addr, @interval, @openTime, @price, @price, @price, @price, @volume)
       ON CONFLICT(token_address, interval, open_time) DO UPDATE SET
         high = CASE WHEN @price > candles.high THEN @price ELSE candles.high END,
         low = CASE WHEN @price < candles.low THEN @price ELSE candles.low END,
         close = @price,
         volume_eth = CAST(candles.volume_eth AS INTEGER) + CAST(@volume AS INTEGER)`,
    )
    .run({ addr, interval, openTime, price, volume });
}

export function updateHolderBalance(
  tokenAddress: string,
  holderAddress: string,
  delta: bigint,
): void {
  const db = getDb();
  const addr = formatAddress(tokenAddress);
  const holder = formatAddress(holderAddress);
  const existing = db
    .prepare("SELECT balance FROM holders WHERE token_address = ? AND address = ?")
    .get(addr, holder) as { balance: string } | undefined;

  const current = existing ? BigInt(existing.balance) : 0n;
  const next = current + delta;
  if (next <= 0n) {
    db.prepare("DELETE FROM holders WHERE token_address = ? AND address = ?").run(
      addr,
      holder,
    );
    return;
  }

  db.prepare(
    `INSERT INTO holders(token_address, address, balance) VALUES(?, ?, ?)
     ON CONFLICT(token_address, address) DO UPDATE SET balance = excluded.balance`,
  ).run(addr, holder, next.toString());
}

export function getToken(address: string): TokenRow | undefined {
  return getDb()
    .prepare("SELECT * FROM tokens WHERE address = ?")
    .get(formatAddress(address)) as TokenRow | undefined;
}

export function listTokens(
  sort: "new" | "volume" | "mcap",
  limit: number,
  offset: number,
): TokenRow[] {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - 86400;

  if (sort === "volume") {
    return db
      .prepare(
        `SELECT t.* FROM tokens t
         LEFT JOIN (
           SELECT token_address, SUM(CAST(eth_amount AS REAL)) AS vol
           FROM trades WHERE timestamp >= ?
           GROUP BY token_address
         ) v ON v.token_address = t.address
         ORDER BY COALESCE(v.vol, 0) DESC, t.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(since, limit, offset) as TokenRow[];
  }

  if (sort === "mcap") {
    return db
      .prepare(
        `SELECT * FROM tokens
         ORDER BY CAST(price_eth AS REAL) * CAST(total_supply AS REAL) DESC, created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as TokenRow[];
  }

  return db
    .prepare("SELECT * FROM tokens ORDER BY created_at DESC, index_num DESC LIMIT ? OFFSET ?")
    .all(limit, offset) as TokenRow[];
}

export function getVolume24h(tokenAddress: string): bigint {
  const since = Math.floor(Date.now() / 1000) - 86400;
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(CAST(eth_amount AS INTEGER)), 0) AS vol
       FROM trades WHERE token_address = ? AND timestamp >= ?`,
    )
    .get(formatAddress(tokenAddress), since) as { vol: number };
  return BigInt(row.vol);
}

export function getTrades(tokenAddress: string, limit: number): TradeRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM trades WHERE token_address = ?
       ORDER BY timestamp DESC, log_index DESC LIMIT ?`,
    )
    .all(formatAddress(tokenAddress), limit) as TradeRow[];
}

export function getCandles(
  tokenAddress: string,
  interval: CandleInterval,
  limit = 500,
): CandleRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM candles WHERE token_address = ? AND interval = ?
       ORDER BY open_time ASC LIMIT ?`,
    )
    .all(formatAddress(tokenAddress), interval, limit) as CandleRow[];
}

export function countHolders(tokenAddress: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM holders WHERE token_address = ?")
    .get(formatAddress(tokenAddress)) as { c: number };
  return row.c;
}

export function getGlobalStats(): {
  totalTokens: number;
  totalVolumeEth: bigint;
} {
  const db = getDb();
  const tokens = db.prepare("SELECT COUNT(*) AS c FROM tokens").get() as { c: number };
  const volume = db
    .prepare("SELECT COALESCE(SUM(CAST(eth_amount AS INTEGER)), 0) AS v FROM trades")
    .get() as { v: number };
  return { totalTokens: tokens.c, totalVolumeEth: BigInt(volume.v) };
}

export function deleteTradesFromBlock(blockNumber: number): void {
  getDb().prepare("DELETE FROM trades WHERE block_number >= ?").run(blockNumber);
}

export function rollbackStateToBlock(blockNumber: number): void {
  const db = getDb();
  db.prepare("DELETE FROM trades WHERE block_number >= ?").run(blockNumber);
  if (blockNumber > 0) {
    setLastIndexedBlock(blockNumber - 1);
  } else {
    setLastIndexedBlock(config.startBlock - 1);
  }
}
