import { Text, View, Pressable, StyleSheet, TextInput, ScrollView, Alert, Platform, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo } from "react";
import { SERVICE_COLORS, Service } from "@/lib/types";
import { TapDurationPicker, formatDuration } from "@/components/tap-duration-picker";



export default function ServiceFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.round(Math.max(16, width * 0.045));

  const existing = useMemo(
    () => (id ? state.services.find((s) => s.id === id) : undefined),
    [state.services, id]
  );

  const [name, setName] = useState(existing?.name ?? "");
  const [duration, setDuration] = useState(existing?.duration ?? 60);
  const [price, setPrice] = useState(existing?.price?.toString() ?? "");
  const [color, setColor] = useState(existing?.color ?? SERVICE_COLORS[0]);
  const [category, setCategory] = useState(existing?.category ?? "");

  const isEdit = !!existing;

  // Collect unique categories from existing services for suggestions
  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    state.services.forEach((s) => { if (s.category) cats.add(s.category); });
    return Array.from(cats).sort();
  }, [state.services]);

  const handleSave = () => {
    if (!name.trim()) return;
    const service: Service = {
      id: existing?.id ?? generateId(),
      name: name.trim(),
      duration,
      price: parseFloat(price) || 0,
      color,
      category: category.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    if (isEdit) {
      dispatch({ type: "UPDATE_SERVICE", payload: service });
      syncToDb({ type: "UPDATE_SERVICE", payload: service });
    } else {
      dispatch({ type: "ADD_SERVICE", payload: service });
      syncToDb({ type: "ADD_SERVICE", payload: service });
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    const doIt = () => {
      dispatch({ type: "DELETE_SERVICE", payload: existing.id });
      syncToDb({ type: "DELETE_SERVICE", payload: existing.id });
      router.back();
    };
    if (Platform.OS === "web") {
      doIt();
    } else {
      Alert.alert("Delete Service", "This will remove the service permanently.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doIt },
      ]);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} tabletMaxWidth={isTablet ? 680 : 0}>
      {/* Header - extra top padding to clear status bar on all devices */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingTop: 16, paddingHorizontal: hp }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginLeft: 16, flex: 1 }} numberOfLines={1}>
            {isEdit ? "Edit Service" : "New Service"}
          </Text>
        </View>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}>
        {/* Name */}
        <Text className="text-xs font-medium text-muted mb-1 ml-1">Service Name</Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-base mb-4 border border-border"
          placeholder="e.g. Haircut, Consultation..."
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          style={{ color: colors.foreground }}
          returnKeyType="next"
        />

        {/* Duration */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginLeft: 4, marginRight: 4 }}>
          <Text className="text-xs font-medium text-muted">Duration</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>{formatDuration(duration)}</Text>
        </View>
        <View style={{ marginBottom: 16 }}>
          <TapDurationPicker value={duration} onChange={setDuration} />
        </View>

        {/* Price */}
        <Text className="text-xs font-medium text-muted mb-1 ml-1">Price ($)</Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-base mb-4 border border-border"
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          style={{ color: colors.foreground }}
          returnKeyType="done"
        />

        {/* Category */}
        <Text className="text-xs font-medium text-muted mb-1 ml-1">Category (optional)</Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-base mb-2 border border-border"
          placeholder="e.g. Hair, Nails, Massage..."
          placeholderTextColor={colors.muted}
          value={category}
          onChangeText={setCategory}
          style={{ color: colors.foreground }}
          returnKeyType="done"
        />
        {existingCategories.length > 0 && !category && (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {existingCategories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={({ pressed }) => [
                  styles.durationChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    minHeight: 32,
                  },
                ]}
              >
                <Text className="text-xs font-medium" style={{ color: colors.foreground }}>{cat}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {!existingCategories.length && <View style={{ height: 8 }} />}

        {/* Color */}
        <Text className="text-xs font-medium text-muted mb-2 ml-1">Color</Text>
        <View className="flex-row gap-3 mb-6">
          {SERVICE_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={({ pressed }) => [
                styles.colorCircle,
                {
                  backgroundColor: c,
                  borderWidth: color === c ? 3 : 0,
                  borderColor: colors.foreground,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            />
          ))}
        </View>

        {/* Preview */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <Text className="text-xs text-muted mb-2">Preview</Text>
          <View className="flex-row items-center">
            <View style={[styles.previewDot, { backgroundColor: color }]} />
            <Text className="text-base font-semibold text-foreground ml-3">
              {name || "Service Name"}
            </Text>
          </View>
          <Text className="text-sm text-muted mt-1 ml-7">
            {duration} min · ${price || "0"}
          </Text>
        </View>

        {/* Delete */}
        {isEdit && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text className="text-sm font-medium" style={{ color: colors.error }}>
              Delete Service
            </Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    minWidth: 70,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  previewDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  deleteButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
  },
});
