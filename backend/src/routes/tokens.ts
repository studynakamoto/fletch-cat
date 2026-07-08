import type { FastifyInstance } from "fastify";
import { getAddress, isAddress } from "viem";
import type { CandleInterval } from "../config.js";
import {
  countHolders,
  getCandles,
  getToken,
  getTrades,
  listTokens,
} from "../db.js";
import {
  serializeCandle,
  serializeTokenDetail,
  serializeTokenListItem,
  serializeTrade,
} from "../serializers.js";

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { sort?: string; limit?: string; offset?: string };
  }>("/tokens", async (request) => {
    const sortRaw = request.query.sort ?? "new";
    const sort =
      sortRaw === "volume" || sortRaw === "mcap" ? sortRaw : "new";
    const limit = Math.min(
      Math.max(Number.parseInt(request.query.limit ?? "50", 10) || 50, 1),
      200,
    );
    const offset = Math.max(
      Number.parseInt(request.query.offset ?? "0", 10) || 0,
      0,
    );

    const rows = listTokens(sort, limit, offset);
    return {
      tokens: rows.map(serializeTokenListItem),
      limit,
      offset,
      sort,
    };
  });

  app.get<{ Params: { address: string } }>(
    "/tokens/:address",
    async (request, reply) => {
      if (!isAddress(request.params.address)) {
        return reply.status(400).send({ error: "Invalid token address" });
      }

      const address = getAddress(request.params.address).toLowerCase();
      const row = getToken(address);
      if (!row) {
        return reply.status(404).send({ error: "Token not found" });
      }

      return serializeTokenDetail(row, countHolders(address));
    },
  );

  app.get<{
    Params: { address: string };
    Querystring: { interval?: string; limit?: string };
  }>("/tokens/:address/candles", async (request, reply) => {
    if (!isAddress(request.params.address)) {
      return reply.status(400).send({ error: "Invalid token address" });
    }

    const intervalRaw = request.query.interval ?? "1m";
    const interval: CandleInterval =
      intervalRaw === "5m" || intervalRaw === "1h" ? intervalRaw : "1m";
    const limit = Math.min(
      Math.max(Number.parseInt(request.query.limit ?? "500", 10) || 500, 1),
      2000,
    );

    const address = getAddress(request.params.address).toLowerCase();
    if (!getToken(address)) {
      return reply.status(404).send({ error: "Token not found" });
    }

    const candles = getCandles(address, interval, limit);
    return { interval, candles: candles.map(serializeCandle) };
  });

  app.get<{
    Params: { address: string };
    Querystring: { limit?: string };
  }>("/tokens/:address/trades", async (request, reply) => {
    if (!isAddress(request.params.address)) {
      return reply.status(400).send({ error: "Invalid token address" });
    }

    const limit = Math.min(
      Math.max(Number.parseInt(request.query.limit ?? "50", 10) || 50, 1),
      500,
    );
    const address = getAddress(request.params.address).toLowerCase();
    if (!getToken(address)) {
      return reply.status(404).send({ error: "Token not found" });
    }

    const trades = getTrades(address, limit);
    return { trades: trades.map(serializeTrade) };
  });
}
