import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useActiveLocation } from "@/hooks/use-active-location";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface LocationSwitcherProps {
  /** If true, show "All Locations" option (default: false) */
  showAll?: boolean;
  /** Compact mode: show only icon + short name (default: false) */
  compact?: boolean;
  /** Optional style for the wrapper View */
  containerStyle?: object;
}

export function LocationSwitcher({ showAll = false, compact = false, containerStyle }: LocationSwitcherProps) {
  const colors = useColors();
  const { activeLocation, activeLocations, hasMultipleLocations, setActiveLocation } =
    useActiveLocation();
  const [open, setOpen] = useState(false);

  // Only render if there are multiple locations
  if (!hasMultipleLocations) return null;

  const displayName = activeLocation
    ? compact && activeLocation.name.length > 14
      ? activeLocation.name.slice(0, 13) + "…"
      : activeLocation.name
    : "All Locations";

  return (
    <View style={containerStyle}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        accessibilityLabel="Switch location"
        accessibilityRole="button"
      >
        <IconSymbol name="mappin.and.ellipse" size={13} color={colors.primary} />
        <Text
          style={[styles.triggerText, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <IconSymbol name="chevron.right" size={11} color={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Select Location
            </Text>

            {showAll && (
              <Pressable
                onPress={() => {
                  setActiveLocation(null);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor:
                      !activeLocation
                        ? colors.primary + "18"
                        : pressed
                        ? colors.border
                        : "transparent",
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.rowText, { color: !activeLocation ? colors.primary : colors.foreground }]}>
                  All Locations
                </Text>
                {!activeLocation && (
                  <IconSymbol name="checkmark" size={16} color={colors.primary} />
                )}
              </Pressable>
            )}

            <FlatList
              data={activeLocations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isActive = item.id === activeLocation?.id;
                return (
                  <Pressable
                    onPress={() => {
                      setActiveLocation(item.id);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: isActive
                          ? colors.primary + "18"
                          : pressed
                          ? colors.border
                          : "transparent",
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.rowContent}>
                      <Text
                        style={[
                          styles.rowText,
                          { color: isActive ? colors.primary : colors.foreground },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {(item.city || item.address) && (
                        <Text
                          style={[styles.rowSub, { color: colors.muted }]}
                          numberOfLines={1}
                        >
                          {item.city
                            ? [item.address, item.city, item.state].filter(Boolean).join(", ")
                            : item.address}
                        </Text>
                      )}
                    </View>
                    {isActive && (
                      <IconSymbol name="checkmark" size={16} color={colors.primary} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 180,
  },
  triggerText: {
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowText: {
    fontSize: 14,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: 12,
  },
});
