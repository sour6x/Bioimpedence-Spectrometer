"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type BISSample = {
  frequency: number;
  resistance: number;
  reactance: number;
  impedance: number;
  phase: number;
};

type LiveBISChartProps = {
  data: BISSample[];
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: BISSample;
  }>;
};

function CustomTooltip({
  active,
  payload,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const sample = payload[0].payload;

  return (
    <div
      style={{
        minWidth: 220,
        padding: "16px 18px",
        border: "1px solid rgba(255, 106, 0, 0.3)",
        borderRadius: 16,
        background: "#111111",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.35)",
      }}
    >
      <div
        style={{
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Frequency:{" "}
        {sample.frequency.toLocaleString()} Hz
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.55)" }}>
            Resistance
          </span>

          <span style={{ color: "#ffffff", fontWeight: 500 }}>
            {sample.resistance.toFixed(2)} Ω
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.55)" }}>
            Reactance
          </span>

          <span style={{ color: "#ffffff", fontWeight: 500 }}>
            {sample.reactance.toFixed(2)} Ω
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.55)" }}>
            Impedance
          </span>

          <span
            style={{
              color: "#ff8a24",
              fontWeight: 600,
            }}
          >
            {sample.impedance.toFixed(2)} Ω
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.55)" }}>
            Phase
          </span>

          <span style={{ color: "#ffffff", fontWeight: 500 }}>
            {sample.phase.toFixed(2)}°
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LiveBISChart({
  data,
}: LiveBISChartProps) {
  return (
    <div style={{ width: "100%", height: 380 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: 20,
            bottom: 10,
            left: 10,
          }}
        >
          <CartesianGrid
            stroke="rgba(255,255,255,0.07)"
            vertical={false}
          />

          <XAxis
            dataKey="frequency"
            tick={{
              fill: "rgba(255,255,255,0.45)",
              fontSize: 11,
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              Number(value) >= 1000
                ? `${Number(value) / 1000}k`
                : String(value)
            }
          />

          <YAxis
            tick={{
              fill: "rgba(255,255,255,0.45)",
              fontSize: 11,
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              `${value} Ω`
            }
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: "rgba(255,106,0,0.35)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />

          <Line
            type="monotone"
            dataKey="impedance"
            stroke="#ff6a00"
            strokeWidth={3}
            dot={{
              r: 4,
              fill: "#ff6a00",
              stroke: "#050505",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: "#ff8a24",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}