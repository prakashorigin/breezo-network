import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
type Point = { label: string; aqi: number };
export function AQIChart({
  data,
  range,
  onRange,
  demo,
}: {
  data: Point[];
  range: string;
  onRange: (range: string) => void;
  demo?: boolean;
}) {
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">AIR QUALITY INDEX</span>
          <h2>AQI over time</h2>
          <p>Network average across active sensor nodes</p>
        </div>
        <div className="chart-controls">
          {["1H", "6H", "24H", "7D"].map((item) => (
            <button
              key={item}
              className={range === item ? "selected" : ""}
              onClick={() => onRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-mint" /> Network AQI
        </span>
        {demo && <span className="chart-demo">Illustrative demo series</span>}
      </div>
      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 14, right: 6, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#23282b"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#717b7b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fill: "#717b7b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#101615",
                border: "1px solid #29312e",
                borderRadius: 10,
                color: "#edf2ef",
              }}
              labelStyle={{ color: "#89938d" }}
            />
            <Area
              type="monotone"
              dataKey="aqi"
              stroke="#82e3b5"
              strokeWidth={2}
              fill="url(#aqiFill)"
              activeDot={{
                r: 4,
                fill: "#b4f7d5",
                stroke: "#173d2c",
                strokeWidth: 4,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-axis-note">
        <span>
          Good <i className="aqi-good" />
        </span>
        <span>
          Moderate <i className="aqi-moderate" />
        </span>
        <span>
          Unhealthy <i className="aqi-bad" />
        </span>
        <span>
          Hazardous <i className="aqi-hazard" />
        </span>
      </div>
    </section>
  );
}
