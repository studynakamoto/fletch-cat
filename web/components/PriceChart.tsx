"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatEther } from "viem";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { fmtUsd, useApiCandles, useApiToken, type ApiCandle, type CandleInterval } from "@/lib/api";

const INTERVALS: { value: CandleInterval; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
];

type ChartMode = "price" | "mcap";
type Denom = "eth" | "usd";

function transformCandles(
  candles: ApiCandle[],
  mode: ChartMode,
  denom: Denom,
  supplyEth: number,
  ethUsd: number,
): ApiCandle[] {
  const scale =
    mode === "mcap"
      ? supplyEth * (denom === "usd" ? ethUsd : 1)
      : denom === "usd"
        ? ethUsd
        : 1;

  if (scale === 0) return candles;

  return candles.map((c) => ({
    ...c,
    open: c.open * scale,
    high: c.high * scale,
    low: c.low * scale,
    close: c.close * scale,
    volume: c.volume * (denom === "usd" ? ethUsd : 1),
  }));
}

function formatChartPrice(value: number, denom: Denom, mode: ChartMode): string {
  if (value === 0) return denom === "usd" ? "$0" : "0 ETH";
  if (denom === "usd") {
    if (mode === "mcap") return fmtUsd(value);
    if (value < 0.0001) return `$${value.toExponential(2)}`;
    return `$${value.toPrecision(4)}`;
  }
  if (value < 0.0001) return `${value.toExponential(2)} ETH`;
  return `${value.toPrecision(4)} ETH`;
}

function pctChange(candles: ApiCandle[]): number | null {
  if (candles.length < 2) return null;
  const prev = candles[candles.length - 2].close;
  const last = candles[candles.length - 1].close;
  if (prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

export function PriceChart({ token, symbol }: { token: `0x${string}`; symbol?: string }) {
  const [interval, setInterval] = useState<CandleInterval>("5m");
  const [mode, setMode] = useState<ChartMode>("price");
  const [denom, setDenom] = useState<Denom>("usd");

  const { data, isLoading } = useApiCandles(token, interval);
  const { data: meta } = useApiToken(token);
  const rawCandles = data?.candles ?? [];

  const supplyEth = useMemo(() => {
    if (!meta?.totalSupply) return 1_000_000_000;
    try {
      return Number(formatEther(BigInt(meta.totalSupply)));
    } catch {
      return 1_000_000_000;
    }
  }, [meta?.totalSupply]);

  const ethUsd = useMemo(() => {
    if (!meta || meta.priceEth <= 0) return 0;
    return meta.priceUsd / meta.priceEth;
  }, [meta]);

  const candles = useMemo(
    () => transformCandles(rawCandles, mode, denom, supplyEth, ethUsd),
    [rawCandles, mode, denom, supplyEth, ethUsd],
  );

  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const change = pctChange(candles);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e11" },
        textColor: "rgba(255,255,255,0.45)",
        fontFamily: "inherit",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: interval === "1m",
        borderColor: "rgba(255,255,255,0.08)",
        rightOffset: 4,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      crosshair: {
        vertLine: { color: "rgba(125,211,252,0.35)", labelBackgroundColor: "#242c37" },
        horzLine: { color: "rgba(125,211,252,0.35)", labelBackgroundColor: "#242c37" },
      },
    });

    const price = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
      priceFormat: {
        type: "custom",
        formatter: (p: number) => formatChartPrice(p, denom, mode),
      },
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    priceSeriesRef.current = price;
    volSeriesRef.current = vol;

    const observer = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, [interval]);

  useEffect(() => {
    if (!priceSeriesRef.current || !volSeriesRef.current) return;

    priceSeriesRef.current.applyOptions({
      priceFormat: {
        type: "custom",
        formatter: (p: number) => formatChartPrice(p, denom, mode),
      },
    });

    priceSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    volSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles, denom, mode]);

  const yLabel =
    mode === "mcap"
      ? denom === "usd"
        ? "Market cap (USD)"
        : "Market cap (ETH)"
      : denom === "usd"
        ? "Price (USD)"
        : "Price (ETH)";

  return (
    <div className="card overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-start justify-between gap-3 border-b border-pump-border/50">
        <div className="min-w-0">
          <div className="text-xs text-white/45 mb-1">{yLabel}</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold tracking-tight">
              {formatChartPrice(lastClose, denom, mode)}
            </span>
            {change !== null && (
              <span
                className={`text-sm font-semibold ${
                  change >= 0 ? "text-pump-green" : "text-pump-red"
                }`}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
            {symbol && <span className="text-sm text-white/40">${symbol}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1">
            {(["price", "mcap"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2 py-1 text-xs rounded font-semibold ${
                  mode === m ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"
                }`}
              >
                {m === "price" ? "Price" : "MCap"}
              </button>
            ))}
            <span className="w-px bg-pump-border/60 mx-0.5" />
            {(["usd", "eth"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDenom(d)}
                className={`px-2 py-1 text-xs rounded font-semibold uppercase ${
                  denom === d ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                type="button"
                onClick={() => setInterval(iv.value)}
                className={`px-2.5 py-1 text-xs rounded font-semibold ${
                  interval === iv.value
                    ? "bg-pump-green text-black"
                    : "bg-pump-bg text-white/55 hover:text-white"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        <div ref={containerRef} className="w-full" />
        {!isLoading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-white/35 text-sm">No trades indexed yet — chart fills as activity happens.</p>
          </div>
        )}
        {isLoading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-white/35 text-sm">Loading chart…</p>
          </div>
        )}
      </div>
    </div>
  );
}
