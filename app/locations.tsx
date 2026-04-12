import { useMemo, useState, useCallback } from "react";
import {
  FlatList,
  Text,
  View,
  Pressable,
  Switch,
  StyleSheet,
  useWindowDimensions,
  Linking,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Location, LOCATION_COLORS, formatFullAddress, getMapUrl, PUBLIC_BOOKING_URL } from "@/lib/types";
import { useActiveLocation } from "@/hooks/use-active-location";

export default function LocationsScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const { activeLocation, setActiveLocation } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.max(16, width * 0.05);

  // Track which location just had its link copied (for toast feedback)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sortedLocations = useMemo(
    () =>
      [...state.locations].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [state.locations]
  );

  /** Toggle a location as the single active location. Deactivates all others. */
  const handleToggleActive = (item: Location, value: boolean) => {
    if (!value) {
      const otherActive = state.locations.find((l) => l.id !== item.id && l.active);
      if (!otherActive) return;
    }
    state.locations.forEach((loc) => {
      const shouldBeActive = loc.id === item.id ? value : value ? false : loc.active;
      if (loc.active !== shouldBeActive) {
        const action = { type: "UPDATE_LOCATION" as const, payload: { ...loc, active: shouldBeActive } };
        dispatch(action);
        syncToDb(action);
      }
    });
    if (value) setActiveLocation(item.id);
  };

  /** Build the unique booking URL for a specific location */
  const getLocationBookingUrl = useCallback(
    (item: Location) => {
      const slug =
        state.settings.customSlug ||
        state.settings.businessName.replace(/\s+/g, "-").toLowerCase();
      return `${PUBLIC_BOOKING_URL}/book/${slug}?location=${item.id}`;
    },
    [state.settings.customSlug, state.settings.businessName]
  );

  /** Copy this location's booking URL to clipboard and show brief toast */
  const handleCopyLink = useCallback(
    async (item: Location) => {
      const url = getLocationBookingUrl(item);
      await Clipboard.setStringAsync(url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2500);
    },
    [getLocationBookingUrl]
  );

  /** Share this location's booking URL via native Share sheet */
  const handleShareLink = useCallback(
    async (item: Location) => {
      const url = getLocationBookingUrl(item);
      const businessName = state.settings.businessName || "our business";
      try {
        await Share.share({
          message: `Book an appointment at ${item.name} — ${businessName}:\n${url}`,
          url, // iOS uses this for the native share card preview
          title: `Book at ${item.name}`,
        });
      } catch {
        // User dismissed the sheet — no action needed
      }
    },
    [getLocationBookingUrl, state.settings.businessName]
  );

  const renderLocation = ({ item }: { item: Location }) => {
    const colorIndex = state.locations.indexOf(item) % LOCATION_COLORS.length;
    const locColor = LOCATION_COLORS[colorIndex];
    const isActiveContext = activeLocation?.id === item.id;
    const formattedAddress = formatFullAddress(item.address, item.city, item.state, item.zipCode);
    const bookingUrl = getLocationBookingUrl(item);
    const isCopied = copiedId === item.id;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isActiveContext ? colors.primary : colors.border,
            borderWidth: isActiveContext ? 1.5 : 1,
          },
        ]}
      >
        {/* Toggle row at top */}
        <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <View style={[styles.colorDot, { backgroundColor: locColor }]} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, flex: 1 }} numberOfLines={1}>
              {item.name}
            </Text>

          </View>
          <Switch
            value={item.active}
            onValueChange={(v) => handleToggleActive(item, v)}
            trackColor={{ false: colors.border, true: colors.primary + "80" }}
            thumbColor={item.active ? colors.primary : colors.muted}
          />
        </View>

        {/* Card body — tappable to edit */}
        <Pressable
          onPress={() => router.push({ pathname: "/location-form", params: { id: item.id } })}
          style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.7 : 1 }]}
        >
          {!!formattedAddress && (
            <Pressable
              onPress={() => Linking.openURL(getMapUrl(formattedAddress))}
              style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <IconSymbol name="mappin" size={13} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.primary, flex: 1, textDecorationLine: "underline" }} numberOfLines={2}>
                {formattedAddress}
              </Text>
              <IconSymbol name="arrow.up.right.square" size={13} color={colors.primary} />
            </Pressable>
          )}

          {!!item.phone && (
            <View style={styles.infoRow}>
              <IconSymbol name="phone.fill" size={13} color={colors.muted} />
              <Text style={{ fontSize: 13, color: colors.muted }}>{item.phone}</Text>
            </View>
          )}
          {!!item.email && (
            <View style={styles.infoRow}>
              <IconSymbol name="envelope.fill" size={13} color={colors.muted} />
              <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>{item.email}</Text>
            </View>
          )}

          <View style={[styles.editRow, { borderTopColor: colors.border }]}>
            <Text style={{ fontSize: 12, color: colors.muted, flex: 1 }}>
              {isActiveContext ? "Currently active location" : item.active ? "Tap to edit" : "Inactive — toggle to activate"}
            </Text>
            <IconSymbol name="chevron.right" size={14} color={colors.muted} />
          </View>
        </Pressable>

        {/* ── Booking Link: URL preview + Copy + Share ── */}
        <View style={[styles.bookingLinkContainer, { borderTopColor: colors.border }]}>
          {/* URL preview line */}
          <Text style={[styles.bookingUrlPreview, { color: colors.muted }]} numberOfLines={1}>
            {bookingUrl}
          </Text>

          {/* Action buttons side by side */}
          <View style={styles.bookingLinkActions}>
            {/* Copy button */}
            <Pressable
              onPress={() => handleCopyLink(item)}
              style={({ pressed }) => [
                styles.linkActionBtn,
                {
                  backgroundColor: isCopied ? colors.success + "18" : colors.primary + "12",
                  borderColor: isCopied ? colors.success + "50" : colors.primary + "30",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol
                name={isCopied ? "checkmark.circle.fill" : "doc.on.doc.fill"}
                size={14}
                color={isCopied ? colors.success : colors.primary}
              />
              <Text style={{ fontSize: 12, fontWeight: "600", color: isCopied ? colors.success : colors.primary }}>
                {isCopied ? "Copied!" : "Copy Link"}
              </Text>
            </Pressable>

            {/* Share button */}
            <Pressable
              onPress={() => handleShareLink(item)}
              style={({ pressed }) => [
                styles.linkActionBtn,
                {
                  backgroundColor: colors.primary + "12",
                  borderColor: colors.primary + "30",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol name="square.and.arrow.up" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>Share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer tabletMaxWidth={900} edges={["top", "left", "right"]} className="pt-2" style={{ paddingHorizontal: hp }}>
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

      {state.locations.length > 1 && (
        <View style={[styles.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <IconSymbol name="info.circle.fill" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, color: colors.primary, flex: 1, lineHeight: 18 }}>
            Only one location can be active at a time. Toggle a location on to switch the entire app to that location's data.
          </Text>
        </View>
      )}

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
    marginBottom: 12,
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
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  card: {
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 0.5,
    marginTop: 4,
  },
  bookingLinkContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    gap: 8,
  },
  bookingUrlPreview: {
    fontSize: 11,
    lineHeight: 16,
  },
  bookingLinkActions: {
    flexDirection: "row",
    gap: 8,
  },
  linkActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
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
