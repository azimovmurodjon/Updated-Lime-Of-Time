import { useMemo } from "react";
import {
  FlatList,
  Text,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Location, LOCATION_COLORS, getMapUrl, PUBLIC_BOOKING_URL } from "@/lib/types";

export default function LocationsScreen() {
  const { state } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.max(16, width * 0.05);

  const sortedLocations = useMemo(
    () =>
      [...state.locations].sort((a, b) => {
        // Default first, then active, then by name
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [state.locations]
  );

  const renderLocation = ({ item }: { item: Location }) => {
    const colorIndex = state.locations.indexOf(item) % LOCATION_COLORS.length;
    const locColor = LOCATION_COLORS[colorIndex];

    return (
      <Pressable
        onPress={() => router.push({ pathname: "/location-form", params: { id: item.id } })}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.colorDot, { backgroundColor: locColor }]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, flex: 1 }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.isDefault && (
                <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}>
                    DEFAULT
                  </Text>
                </View>
              )}
              {!item.active && (
                <View style={[styles.badge, { backgroundColor: colors.error + "20" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.error }}>
                    INACTIVE
                  </Text>
                </View>
              )}
            </View>
            {!!item.address && (
              <Pressable
                onPress={() => Linking.openURL(getMapUrl(item.address))}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text
                  style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}
                  numberOfLines={2}
                >
                  {item.address}
                </Text>
              </Pressable>
            )}
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </View>

        {/* Contact info */}
        {(!!item.phone || !!item.email) && (
          <View style={[styles.contactRow, { borderTopColor: colors.border }]}>
            {!!item.phone && (
              <View style={styles.contactItem}>
                <IconSymbol name="phone.fill" size={13} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted }}>{item.phone}</Text>
              </View>
            )}
            {!!item.email && (
              <View style={styles.contactItem}>
                <IconSymbol name="envelope.fill" size={13} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Schedule info */}
        <View style={[styles.scheduleRow, { borderTopColor: colors.border }]}>
          <IconSymbol name="clock.fill" size={13} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {item.workingHours ? "Custom schedule" : "Uses business hours"}
          </Text>
        </View>

        {/* Booking link */}
        {!!state.settings.customSlug && item.active && (
          <Pressable
            onPress={() => {
              const slug = state.settings.customSlug;
              // Copy to clipboard or open
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(`Book at ${item.name}: ${PUBLIC_BOOKING_URL}/api/book/${slug}?location=${item.id}`);
              }
            }}
            style={({ pressed }) => [styles.bookingLinkRow, { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <IconSymbol name="link" size={13} color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.primary, flex: 1 }} numberOfLines={1}>
              Booking link for this location
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <ScreenContainer tabletMaxWidth={900} edges={["top", "left", "right"]} className="pt-2" style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground" style={{ flex: 1 }}>
          Locations
        </Text>
        <Pressable
          onPress={() => router.push("/location-form")}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <IconSymbol name="plus" size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Add</Text>
        </Pressable>
      </View>

      {sortedLocations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="building.2.fill" size={48} color={colors.muted} />
          <Text className="text-lg font-semibold text-foreground mt-4">No Locations Yet</Text>
          <Text className="text-sm text-muted text-center mt-2" style={{ maxWidth: 280 }}>
            Add your business locations to manage multiple branches, each with their own address and schedule.
          </Text>
          <Pressable
            onPress={() => router.push("/location-form")}
            style={({ pressed }) => [
              styles.emptyBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>
              Add First Location
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedLocations}
          renderItem={renderLocation}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  bookingLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  emptyBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
