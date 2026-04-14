import { useState, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Location,
  formatPhoneNumber,
} from "@/lib/types";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";

export default function LocationFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch, syncToDb } = useStore();
  const { setActiveLocation } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();

  const existing = useMemo(
    () => (id ? state.locations.find((l) => l.id === id) : undefined),
    [state.locations, id]
  );

  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [locationState, setLocationState] = useState(existing?.state ?? "");
  const [zipCode, setZipCode] = useState(existing?.zipCode ?? "");
  const [phone, setPhone] = useState(formatPhoneNumber(existing?.phone ?? ""));
  const [email, setEmail] = useState(existing?.email ?? "");
  // Validation errors
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});

  const handleSave = () => {
    const newErrors: { name?: string; address?: string } = {};
    if (!name.trim()) newErrors.name = "Location name is required";
    if (!address.trim()) newErrors.address = "Street address is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    // New locations default to active. The first location is also set as default.
    const isFirstLocation = !isEdit && state.locations.length === 0;

    const loc: Location = {
      id: existing?.id ?? generateId(),
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: locationState.trim(),
      zipCode: zipCode.trim(),
      phone: phone.trim(),
      email: email.trim(),
      isDefault: existing?.isDefault ?? isFirstLocation,
      active: existing?.active ?? true,
      temporarilyClosed: existing?.temporarilyClosed,
      reopenOn: existing?.reopenOn,
      workingHours: existing?.workingHours ?? {},
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const action = isEdit
      ? { type: "UPDATE_LOCATION" as const, payload: loc }
      : { type: "ADD_LOCATION" as const, payload: loc };

    dispatch(action);
    syncToDb(action);
    // Auto-set as active location when adding a new location
    if (!isEdit) setActiveLocation(loc.id);
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      "Delete Location",
      `Are you sure you want to delete "${existing.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const action = { type: "DELETE_LOCATION" as const, payload: existing.id };
            dispatch(action);
            syncToDb(action);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} tabletMaxWidth={720} className="pt-2" style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground" style={{ flex: 1 }}>
          {isEdit ? "Edit Location" : "Add Location"}
        </Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Basic Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-3">Location Details</Text>

          <Text className="text-xs font-medium text-muted mb-1">Name *</Text>
          <TextInput
            value={name}
            onChangeText={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
            placeholder="e.g. Main Office, Downtown Branch"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: errors.name ? colors.error : colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />
          {errors.name ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.name}</Text> : null}

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Address *</Text>
          <TextInput
            value={address}
            onChangeText={(v) => { setAddress(v); if (errors.address) setErrors((e) => ({ ...e, address: undefined })); }}
            placeholder="e.g. 123 Main Street"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: errors.address ? colors.error : colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />
          {errors.address ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.address}</Text> : null}

          {/* City / State / ZIP row */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 2 }}>
              <Text className="text-xs font-medium text-muted mb-1">City</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="e.g. New York"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-xs font-medium text-muted mb-1">State</Text>
              <TextInput
                value={locationState}
                onChangeText={setLocationState}
                placeholder="NY"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                maxLength={2}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-xs font-medium text-muted mb-1">ZIP</Text>
              <TextInput
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="10001"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={10}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
          </View>

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Phone</Text>
          <TextInput
            value={phone}
            onChangeText={(val) => setPhone(formatPhoneNumber(val))}
            placeholder="e.g. (212) 555-0100"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. info@yourbusiness.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />
        </View>

        {/* Delete Button (edit mode only) */}
        {isEdit && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteBtn,
              { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconSymbol name="trash.fill" size={18} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: "600", fontSize: 15 }}>
              Delete Location
            </Text>
          </Pressable>
        )}
      </ScrollView>
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
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
});
