import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Line, Text as SvgText, Circle, Path, G } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";

// ─── Bar Chart ──────────────────────────────────────────────────────
interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  title?: string;
}

export function MiniBarChart({ data, height = 140, title }: BarChartProps) {
  const colors = useColors();
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartW = 280;
  const chartH = height - 30;
  const barW = Math.min(28, (chartW - 20) / data.length - 6);
  const gap = (chartW - data.length * barW) / (data.length + 1);

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={[styles.chartTitle, { color: colors.foreground }]}>{title}</Text>}
      <Svg width={chartW} height={height} viewBox={`0 0 ${chartW} ${height}`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <Line
            key={pct}
            x1={0}
            y1={chartH * (1 - pct)}
            x2={chartW}
            y2={chartH * (1 - pct)}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * (chartH - 10);
          const x = gap + i * (barW + gap);
          const y = chartH - barH;
          const barColor = d.color || colors.primary;
          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={4}
                fill={barColor}
                opacity={0.85}
              />
              <SvgText
                x={x + barW / 2}
                y={height - 2}
                fontSize={9}
                fill={colors.muted}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
              {d.value > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={y - 4}
                  fontSize={9}
                  fill={colors.foreground}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : String(d.value)}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── Line Chart ─────────────────────────────────────────────────────
interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  title?: string;
  color?: string;
}

export function MiniLineChart({ data, height = 120, title, color }: LineChartProps) {
  const colors = useColors();
  if (data.length < 2) return null;

  const chartW = 280;
  const chartH = height - 30;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const lineColor = color || colors.primary;
  const padding = 10;
  const usableW = chartW - padding * 2;
  const stepX = usableW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: chartH - (d.value / maxVal) * (chartH - 20) + 5,
  }));

  // Build smooth path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + stepX * 0.4;
    const cpx2 = curr.x - stepX * 0.4;
    pathD += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Area fill path
  const areaD = pathD + ` L ${points[points.length - 1].x} ${chartH} L ${points[0].x} ${chartH} Z`;

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={[styles.chartTitle, { color: colors.foreground }]}>{title}</Text>}
      <Svg width={chartW} height={height} viewBox={`0 0 ${chartW} ${height}`}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((pct) => (
          <Line
            key={pct}
            x1={0}
            y1={chartH * (1 - pct) + 5}
            x2={chartW}
            y2={chartH * (1 - pct) + 5}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}
        {/* Area fill */}
        <Path d={areaD} fill={lineColor} opacity={0.08} />
        {/* Line */}
        <Path d={pathD} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={lineColor} />
        ))}
        {/* Labels */}
        {data.map((d, i) => (
          <SvgText
            key={i}
            x={points[i].x}
            y={height - 2}
            fontSize={9}
            fill={colors.muted}
            textAnchor="middle"
          >
            {d.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ─── Donut Chart ────────────────────────────────────────────────────
interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  title?: string;
  centerLabel?: string;
  centerValue?: string;
}

export function MiniDonutChart({ data, size = 120, title, centerLabel, centerValue }: DonutChartProps) {
  const colors = useColors();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = size / 2 - 12;
  const strokeW = 18;
  const innerR = radius - strokeW / 2;
  const cx = size / 2;
  const cy = size / 2;

  let startAngle = -90;
  const arcs = data.map((d) => {
    const angle = (d.value / total) * 360;
    const arc = { ...d, startAngle, angle };
    startAngle += angle;
    return arc;
  });

  function describeArc(startDeg: number, angleDeg: number) {
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = ((startDeg + angleDeg) * Math.PI) / 180;
    const x1 = cx + innerR * Math.cos(startRad);
    const y1 = cy + innerR * Math.sin(startRad);
    const x2 = cx + innerR * Math.cos(endRad);
    const y2 = cy + innerR * Math.sin(endRad);
    const largeArc = angleDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${innerR} ${innerR} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={[styles.chartTitle, { color: colors.foreground }]}>{title}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((arc, i) => (
            <Path
              key={i}
              d={describeArc(arc.startAngle, Math.max(arc.angle - 1, 0.5))}
              stroke={arc.color}
              strokeWidth={strokeW}
              fill="none"
              strokeLinecap="round"
            />
          ))}
          {centerValue && (
            <>
              <SvgText
                x={cx}
                y={cy - 2}
                fontSize={18}
                fontWeight="700"
                fill={colors.foreground}
                textAnchor="middle"
              >
                {centerValue}
              </SvgText>
              {centerLabel && (
                <SvgText
                  x={cx}
                  y={cy + 14}
                  fontSize={10}
                  fill={colors.muted}
                  textAnchor="middle"
                >
                  {centerLabel}
                </SvgText>
              )}
            </>
          )}
        </Svg>
        {/* Legend */}
        <View style={{ marginLeft: 12, gap: 6, flex: 1 }}>
          {data.map((d, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
              <Text style={{ fontSize: 11, color: colors.muted, flex: 1 }} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }}>
                {d.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    marginBottom: 4,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
});
