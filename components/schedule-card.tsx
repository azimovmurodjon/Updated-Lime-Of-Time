/**
 * ScheduleCard — swipeable 2-slide card:
 *   Slide 1 (Today): max 3 visible, scrollable if more
 *   Slide 2 (Upcoming): fully scrollable list
 */
import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { formatTime, formatDateStr } from "@/lib/store";
import { minutesToTime, timeToMinutes } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import type { Appointment, Service, Client, StaffMember, Location } from "@/lib/types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ScheduleCardProps {
  todayAppts: Appointment[];
  upcomingAppointments: Appointment[];
  /** null = All Locations mode (show location badge) */
  selectedLocationFilter: string | null;
  getServiceById: (id: string) => Service | undefined;
  getClientById: (id: string) => Client | undefined;
  staff: StaffMember[];
  locations: Location[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEndTime(time: string, duration: number): string {
  return formatTime(minutesToTime(timeToMinutes(time) + duration));
}

const SLIDES = ["Today", "Upcoming"] as const;
type Slide = typeof SLIDES[number];

// ─── Appointment Row ──────────────────────────────────────────────────────────

interface ApptRowProps {
  appt: Appointment;
  showDate?: boolean;
  selectedLocationFilter: string | null;
  getServiceById: (id: string) => Service | undefined;
  getClientById: (id: string) => Client | undefined;
  staff: StaffMember[];
  locations: Location[];
  colors: ReturnType<typeof useColors>;
  router: ReturnType<typeof useRouter>;
}

function ApptRow({
  appt,
  showDate = false,
  selectedLocationFilter,
  getServiceById,
  getClientById,
  staff,
  locations,
  colors,
  router,
}: ApptRowProps) {
  const svc = getServiceById(appt.serviceId);
  const client = getClientById(appt.clientId);
  const staffMember = appt.staffId ? staff.find((s) => s.id === appt.staffId) : null;
  const apptLocation = appt.locationId ? locations.find((l) => l.id === appt.locationId) : null;
  const accentColor = svc?.color ?? colors.primary;

  const statusColor =
    appt.status === "confirmed" ? colors.success
    : appt.status === "pending" ? "#FF9800"
    : appt.status === "completed" ? colors.primary
    : appt.status === "no_show" ? "#F59E0B"
    : colors.error;

  const timeLabel = `${formatTime(appt.time)} – ${getEndTime(appt.time, appt.duration)}`;
  const clientPhone = client?.phone ? formatPhone(client.phone) : null;

  const apptDate = new Date(appt.date + "T00:00:00");
  const dateTimeLabel = showDate
    ? `${apptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${timeLabel}`
    : timeLabel;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })}
      style={({ pressed }) => [
        styles.apptCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderLeftColor: accentColor,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ padding: 14, gap: 5 }}>
        {/* Row 1: time/date range (left) + status badge (right) */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, flex: 1, marginRight: 8 }}
            numberOfLines={1}
          >
            {dateTimeLabel}
          </Text>
          <View style={{ backgroundColor: statusColor + "22", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>
              {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
            </Text>
          </View>
        </View>
        {/* Row 2: service name + duration */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
          {svc ? `${svc.name} (${appt.duration ?? svc.duration} min)` : "Service"}
        </Text>
        {/* Row 3: client name · phone + staff dot */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, color: colors.muted, flex: 1, marginRight: 8 }} numberOfLines={1}>
            {client?.name ?? "Client"}{clientPhone ? ` · ${clientPhone}` : ""}
          </Text>
          {staffMember ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor }} />
              <Text style={{ fontSize: 13, color: accentColor, fontWeight: "600" }} numberOfLines={1}>
                {staffMember.name}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Row 4: location badge — shown only in All Locations mode */}
        {!selectedLocationFilter && apptLocation && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <IconSymbol name="mappin.circle.fill" size={12} color={colors.muted} />
            <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{apptLocation.name}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const APPT_ROW_HEIGHT = 108; // approximate height of one appointment card
const MAX_TODAY_VISIBLE = 3;

export function ScheduleCard({
  todayAppts,
  upcomingAppointments,
  selectedLocationFilter,
  getServiceById,
  getClientById,
  staff,
  locations,
}: ScheduleCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Card width is the full screen width minus horizontal padding (16 on each side)
  const cardWidth = screenWidth - 32;

  const handleMomentumScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setActiveIdx(Math.max(0, Math.min(idx, SLIDES.length - 1)));
  };

  const ACCENT = "#00C896";
  const todayStr = formatDateStr(new Date());

  // Next upcoming appointment date for the Upcoming slide "View All" button
  const nextUpcomingDate = upcomingAppointments.length > 0
    ? upcomingAppointments[0].date
    : todayStr;

  const todayMaxHeight = MAX_TODAY_VISIBLE * APPT_ROW_HEIGHT + (MAX_TODAY_VISIBLE - 1) * 10;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.iconBg, { backgroundColor: ACCENT + "18" }]}>
            <IconSymbol name="calendar" size={16} color={ACCENT} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {SLIDES[activeIdx]}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* Count badge */}
          <View style={{ backgroundColor: ACCENT + "18", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: ACCENT }}>
              {activeIdx === 0
                ? `${todayAppts.length} appt${todayAppts.length !== 1 ? "s" : ""}`
                : `${upcomingAppointments.length} scheduled`}
            </Text>
          </View>
          {/* View All button — Today slide → Day view; Upcoming slide → Month view */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/calendar",
                params: activeIdx === 0
                  ? { date: todayStr, view: "day" }
                  : { date: nextUpcomingDate, view: "month" },
              } as any)
            }
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: colors.primary + "15",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>View All</Text>
            <IconSymbol name="chevron.right" size={12} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Swipeable slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={cardWidth}
        snapToAlignment="start"
        style={{ width: cardWidth }}
      >
        {/* Slide 1: Today */}
        <View style={{ width: cardWidth, paddingHorizontal: 0, paddingBottom: 4 }}>
          {todayAppts.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: colors.border }]}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: ACCENT + "15", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                <IconSymbol name="calendar" size={28} color={ACCENT + "90"} />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
                No appointments today
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                Your schedule is clear — enjoy your day!
              </Text>
              <Pressable
                onPress={() => router.push("/new-booking")}
                style={({ pressed }) => [
                  styles.bookBtn,
                  { backgroundColor: ACCENT, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.bookBtnText}>Book an Appointment</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: todayMaxHeight }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
            >
              {todayAppts.map((appt) => (
                <ApptRow
                  key={appt.id}
                  appt={appt}
                  showDate={false}
                  selectedLocationFilter={selectedLocationFilter}
                  getServiceById={getServiceById}
                  getClientById={getClientById}
                  staff={staff}
                  locations={locations}
                  colors={colors}
                  router={router}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Slide 2: Upcoming */}
        <View style={{ width: cardWidth, paddingHorizontal: 0, paddingBottom: 4 }}>
          {upcomingAppointments.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: colors.border, paddingVertical: 24 }]}>
              <IconSymbol name="calendar.badge.checkmark" size={32} color={ACCENT + "70"} />
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 10 }}>
                No upcoming appointments
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                All clear — add a booking to see it here.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
              style={{ maxHeight: MAX_TODAY_VISIBLE * APPT_ROW_HEIGHT + (MAX_TODAY_VISIBLE - 1) * 10 }}
            >
              {upcomingAppointments.map((appt) => (
                <ApptRow
                  key={appt.id}
                  appt={appt}
                  showDate={true}
                  selectedLocationFilter={selectedLocationFilter}
                  getServiceById={getServiceById}
                  getClientById={getClientById}
                  staff={staff}
                  locations={locations}
                  colors={colors}
                  router={router}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Page dots */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIdx ? ACCENT : colors.border,
                  width: i === activeIdx ? 16 : 5,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  iconBg: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  apptCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: "hidden",
    marginHorizontal: 0,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 0,
  },
  bookBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    paddingVertical: 10,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
});
