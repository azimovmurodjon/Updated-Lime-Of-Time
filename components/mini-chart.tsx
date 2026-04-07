import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Line, Text as SvgText, Circle, Path, G, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";

// ─── Bar Chart ──────────────────────────────────────────────────────
interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  width?: number;
  title?: string;
}

export function MiniBarChart({ data, height = 160, width: chartW = 280, title }: BarChartProps) {
  const colors = useColors();
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartH = height - 30;
  const barW = Math.min(32, (chartW - 20) / data.length - 8);
  const gap = (chartW - data.length * barW) / (data.length + 1);

  // Nice grid values
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={[styles.chartTitle, { color: colors.foreground }]}>{title}</Text>}
      <Svg width={chartW} height={height} viewBox={`0 0 ${chartW} ${height}`}>
        <Defs>
          {data.map((d, i) => (
            <LinearGradient key={`grad-${i}`} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={d.color || colors.primary} stopOpacity="1" />
              <Stop offset="1" stopColor={d.color || colors.primary} stopOpacity="0.6" />
            </LinearGradient>
          ))}
        </Defs>
        {/* Grid lines with labels */}
        {gridLines.map((pct) => {
          const y = chartH * (1 - pct);
          const val = Math.round(maxVal * pct);
          return (
            <G key={pct}>
              <Line
                x1={0}
                y1={y}
                x2={chartW}
                y2={y}
                stroke={colors.border}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            </G>
          );
        })}
        {/* Bars with gradient */}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / maxVal) * (chartH - 10));
          const x = gap + i * (barW + gap);
          const y = chartH - barH;
          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={barW > 16 ? 6 : 4}
                fill={`url(#barGrad${i})`}
              />
              <SvgText
                x={x + barW / 2}
                y={height - 4}
                fontSize={10}
                fill={colors.muted}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
              {d.value > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={y - 6}
                  fontSize={10}
                  fill={colors.foreground}
                  textAnchor="middle"
                  fontWeight="700"
                >
                  {d.value >= 1000 ? `$${(d.value / 1000).toFixed(1)}k` : `$${d.value}`}
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
  width?: number;
  title?: string;
  color?: string;
}

export function MiniLineChart({ data, height = 140, width: chartW = 280, title, color }: LineChartProps) {
  const colors = useColors();
  if (data.length < 2) return null;

  const chartH = height - 30;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const lineColor = color || colors.primary;
  const padding = 14;
  const usableW = chartW - padding * 2;
  const stepX = usableW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: chartH - (d.value / maxVal) * (chartH - 20) + 5,
  }));

  // Build smooth bezier path
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
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.2" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
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
        {/* Area fill with gradient */}
        <Path d={areaD} fill="url(#areaGrad)" />
        {/* Line */}
        <Path d={pathD} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={4} fill={lineColor} />
            <Circle cx={p.x} cy={p.y} r={2} fill="#fff" />
          </G>
        ))}
        {/* Labels */}
        {data.map((d, i) => (
          <SvgText
            key={i}
            x={points[i].x}
            y={height - 4}
            fontSize={10}
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
  compact?: boolean;
}

export function MiniDonutChart({ data, size = 100, title, centerLabel, centerValue, compact }: DonutChartProps) {
  const colors = useColors();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = size / 2 - 10;
  const strokeW = compact ? 14 : 18;
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

  if (compact) {
    return (
      <View style={styles.chartContainer}>
        {title && <Text style={[styles.chartTitle, { color: colors.foreground }]}>{title}</Text>}
        <View style={{ alignItems: "center" }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {arcs.map((arc, i) => (
              <Path
                key={i}
                d={describeArc(arc.startAngle, Math.max(arc.angle - 1.5, 0.5))}
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
                  y={cy + 1}
                  fontSize={compact ? 14 : 18}
                  fontWeight="700"
                  fill={colors.foreground}
                  textAnchor="middle"
                  alignmentBaseline="central"
                >
                  {centerValue}
                </SvgText>
              </>
            )}
          </Svg>
          {/* Legend below */}
          <View style={{ marginTop: 8, gap: 3, width: "100%" }}>
            {data.slice(0, 4).map((d, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.color }} />
                <Text style={{ fontSize: 10, color: colors.muted, flex: 1 }} numberOfLines={1}>
                  {d.label}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.foreground }}>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={[styles.chartTitle, { color: colors.foreground }]}>{title}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((arc, i) => (
            <Path
              key={i}
              d={describeArc(arc.startAngle, Math.max(arc.angle - 1.5, 0.5))}
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
                y={cy - 4}
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
        <View style={{ marginLeft: 14, gap: 6, flex: 1 }}>
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
