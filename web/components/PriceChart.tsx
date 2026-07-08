"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useApiCandles, type CandleInterval } from "@/lib/api";

const INTERVALS: CandleInterval[] = ["1m", "5m", "1h"];

export function PriceChart({ token }: { token: `0x${string}` }) {
  const [interval, setInterval] = useState<CandleInterval>("5m");
  const { data, isLoading } = useApiCandles(token, interval);
  const candles = data?.candles ?? [];

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.5)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      crosshair: { horzLine: { labelVisible: true } },
    });

    const price = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
      priceFormat: { type: "price", precision: 9, minMove: 1e-9 },
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(34,197,94,0.3)",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

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
  }, []);

  useEffect(() => {
    if (!priceSeriesRef.current || !volSeriesRef.current) return;
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
        color: c.close >= c.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/60">Price (ETH)</span>
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-2 py-1 text-xs rounded ${
                interval === iv ? "bg-pump-green text-black font-semibold" : "bg-pump-bg text-white/60"
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
      {!isLoading && candles.length === 0 && (
        <p className="text-white/40 text-sm text-center -mt-40 relative pointer-events-none">
          No trades indexed yet
        </p>
      )}
    </div>
  );
}
