import React, { useMemo, useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import type { Service, Product } from "@/lib/types";

interface GroupedServicePickerProps {
  services: Service[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  title?: string;
}

interface GroupedProductPickerProps {
  products: Product[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  title?: string;
}

/** Group services by category with collapsible headers */
export function GroupedServicePicker({
  services,
  selectedIds,
  onToggle,
  title = "Services",
}: GroupedServicePickerProps) {
  const colors = useColors();

  const groups = useMemo(() => {
    const map = new Map<string, Service[]>();
    services.forEach((s) => {
      const cat = s.category?.trim() || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    // Sort categories alphabetically, but "General" last
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "General") return 1;
      if (b[0] === "General") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [services]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const hasMultipleGroups = groups.length > 1;

  return (
    <View>
      {title ? (
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>
          {title}
        </Text>
      ) : null}
      {groups.map(([category, items]) => (
        <View key={category} style={{ marginBottom: 8 }}>
          {hasMultipleGroups && (
            <Pressable
              onPress={() =>
                setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }))
              }
              style={({ pressed }) => [
                styles.groupHeader,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                  {category}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  ({items.length})
                </Text>
              </View>
              <IconSymbol
                name={collapsed[category] ? "chevron.right" : "chevron.down"}
                size={14}
                color={colors.muted}
              />
            </Pressable>
          )}
          {!collapsed[category] &&
            items.map((svc) => {
              const isSelected = selectedIds.includes(svc.id);
              return (
                <Pressable
                  key={svc.id}
                  onPress={() => onToggle(svc.id)}
                  style={({ pressed }) => [
                    styles.itemRow,
                    {
                      backgroundColor: isSelected
                        ? colors.primary + "12"
                        : "transparent",
                      borderColor: isSelected ? colors.primary + "40" : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: isSelected ? "600" : "400",
                        color: colors.foreground,
                      }}
                      numberOfLines={1}
                    >
                      {svc.name}
                      {svc.duration ? ` (${svc.duration} min)` : ""}
                    </Text>
                    {!hasMultipleGroups && svc.category ? (
                      <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                        {svc.category}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isSelected ? colors.primary : colors.foreground,
                      marginRight: 8,
                    }}
                  >
                    ${svc.price.toFixed(2)}
                  </Text>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {isSelected && (
                      <IconSymbol name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                </Pressable>
              );
            })}
        </View>
      ))}
    </View>
  );
}

/** Group products by brand with collapsible headers */
export function GroupedProductPicker({
  products,
  selectedIds,
  onToggle,
  title = "Products",
}: GroupedProductPickerProps) {
  const colors = useColors();

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
    products.forEach((p) => {
      const br = p.brand?.trim() || "Other";
      if (!map.has(br)) map.set(br, []);
      map.get(br)!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "Other") return 1;
      if (b[0] === "Other") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [products]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const hasMultipleGroups = groups.length > 1;

  return (
    <View>
      {title ? (
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>
          {title}
        </Text>
      ) : null}
      {groups.map(([brand, items]) => (
        <View key={brand} style={{ marginBottom: 8 }}>
          {hasMultipleGroups && (
            <Pressable
              onPress={() =>
                setCollapsed((prev) => ({ ...prev, [brand]: !prev[brand] }))
              }
              style={({ pressed }) => [
                styles.groupHeader,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.warning,
                  }}
                />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                  {brand}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  ({items.length})
                </Text>
              </View>
              <IconSymbol
                name={collapsed[brand] ? "chevron.right" : "chevron.down"}
                size={14}
                color={colors.muted}
              />
            </Pressable>
          )}
          {!collapsed[brand] &&
            items.map((prod) => {
              const isSelected = selectedIds.includes(prod.id);
              return (
                <Pressable
                  key={prod.id}
                  onPress={() => onToggle(prod.id)}
                  style={({ pressed }) => [
                    styles.itemRow,
                    {
                      backgroundColor: isSelected
                        ? colors.primary + "12"
                        : "transparent",
                      borderColor: isSelected ? colors.primary + "40" : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: isSelected ? "600" : "400",
                        color: colors.foreground,
                      }}
                      numberOfLines={1}
                    >
                      {prod.name}
                    </Text>
                    {!hasMultipleGroups && prod.brand ? (
                      <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                        {prod.brand}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isSelected ? colors.primary : colors.foreground,
                      marginRight: 8,
                    }}
                  >
                    ${prod.price.toFixed(2)}
                  </Text>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {isSelected && (
                      <IconSymbol name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                </Pressable>
              );
            })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
