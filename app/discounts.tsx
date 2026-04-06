import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
  ScrollView,
  Switch,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useCallback, useMemo } from "react";
import {
  Discount,
  DAYS_OF_WEEK,
  formatTimeDisplay,
  generateAllTimeOptions,
} from "@/lib/types";

const DAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const TIME_OPTIONS = generateAllTimeOptions();

export default function DiscountsScreen() {
  const { state, dispatch, syncToDb, getServiceById } = useStore();
  const colors = useColors();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [selectedDays, setSelectedDays] = useState<string[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[] | null>(
    null
  );
  const [showTimePicker, setShowTimePicker] = useState<
    "start" | "end" | null
  >(null);

  const resetForm = useCallback(() => {
    setName("");
    setPercentage("10");
    setStartTime("09:00");
    setEndTime("12:00");
    setSelectedDays([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]);
    setSelectedServiceIds(null);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const handleEdit = useCallback((disc: Discount) => {
    setEditingId(disc.id);
    setName(disc.name);
    setPercentage(String(disc.percentage));
    setStartTime(disc.startTime);
    setEndTime(disc.endTime);
    setSelectedDays(disc.daysOfWeek);
    setSelectedServiceIds(disc.serviceIds);
    setShowForm(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a discount name.");
      return;
    }
    const pct = parseInt(percentage, 10);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      Alert.alert("Invalid", "Percentage must be between 1 and 100.");
      return;
    }

    if (editingId) {
      const updated: Discount = {
        id: editingId,
        name: name.trim(),
        percentage: pct,
        startTime,
        endTime,
        daysOfWeek: selectedDays,
        serviceIds: selectedServiceIds,
        active: state.discounts.find((d) => d.id === editingId)?.active ?? true,
        createdAt:
          state.discounts.find((d) => d.id === editingId)?.createdAt ??
          new Date().toISOString(),
      };
      dispatch({ type: "UPDATE_DISCOUNT", payload: updated });
      syncToDb({ type: "UPDATE_DISCOUNT", payload: updated });
    } else {
      const newDiscount: Discount = {
        id: generateId(),
        name: name.trim(),
        percentage: pct,
        startTime,
        endTime,
        daysOfWeek: selectedDays,
        serviceIds: selectedServiceIds,
        active: true,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_DISCOUNT", payload: newDiscount });
      syncToDb({ type: "ADD_DISCOUNT", payload: newDiscount });
    }
    resetForm();
  }, [
    name,
    percentage,
    startTime,
    endTime,
    selectedDays,
    selectedServiceIds,
    editingId,
    state.discounts,
    dispatch,
    syncToDb,
    resetForm,
  ]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Discount", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            dispatch({ type: "DELETE_DISCOUNT", payload: id });
            syncToDb({ type: "DELETE_DISCOUNT", payload: id });
          },
        },
      ]);
    },
    [dispatch, syncToDb]
  );

  const handleToggleActive = useCallback(
    (disc: Discount) => {
      const updated = { ...disc, active: !disc.active };
      dispatch({ type: "UPDATE_DISCOUNT", payload: updated });
      syncToDb({ type: "UPDATE_DISCOUNT", payload: updated });
    },
    [dispatch, syncToDb]
  );

  const toggleDay = useCallback(
    (day: string) => {
      setSelectedDays((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      );
    },
    []
  );

  const toggleServiceFilter = useCallback(
    (serviceId: string) => {
      setSelectedServiceIds((prev) => {
        if (!prev) return [serviceId];
        if (prev.includes(serviceId)) {
          const next = prev.filter((id) => id !== serviceId);
          return next.length === 0 ? null : next;
        }
        return [...prev, serviceId];
      });
    },
    []
  );

  const sortedDiscounts = useMemo(
    () =>
      [...state.discounts].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [state.discounts]
  );

  const renderDiscount = useCallback(
    ({ item }: { item: Discount }) => {
      const serviceNames =
        item.serviceIds && item.serviceIds.length > 0
          ? item.serviceIds
              .map((id) => getServiceById(id)?.name ?? "Unknown")
              .join(", ")
          : "All Services";
      const dayLabels = item.daysOfWeek.map((d) => DAY_LABELS[d] ?? d).join(", ");

      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: item.active ? 1 : 0.6,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.cardTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
                {item.percentage}% off
              </Text>
            </View>
            <Switch
              value={item.active}
              onValueChange={() => handleToggleActive(item)}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={item.active ? colors.primary : colors.muted}
            />
          </View>
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <IconSymbol name="clock.fill" size={14} color={colors.muted} />
              <Text style={[styles.detailText, { color: colors.muted }]}>
                {formatTimeDisplay(item.startTime)} -{" "}
                {formatTimeDisplay(item.endTime)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={14} color={colors.muted} />
              <Text
                style={[styles.detailText, { color: colors.muted }]}
                numberOfLines={1}
              >
                {dayLabels || "No days selected"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="list.bullet" size={14} color={colors.muted} />
              <Text
                style={[styles.detailText, { color: colors.muted }]}
                numberOfLines={1}
              >
                {serviceNames}
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable
              onPress={() => handleEdit(item)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.primary + "15" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="pencil" size={16} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                Edit
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleDelete(item.id)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.error + "15" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="trash.fill" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [colors, getServiceById, handleEdit, handleDelete, handleToggleActive]
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Discounts
        </Text>
        <Pressable
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8 },
          ]}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {sortedDiscounts.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <IconSymbol name="tag.fill" size={48} color={colors.muted + "40"} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No Discounts Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Create time-based discounts to attract more clients during specific
            hours.
          </Text>
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [
              styles.emptyBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.emptyBtnText}>Create Discount</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedDiscounts}
          keyExtractor={(item) => item.id}
          renderItem={renderDiscount}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            showForm ? (
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.formTitle, { color: colors.foreground }]}
                >
                  {editingId ? "Edit Discount" : "New Discount"}
                </Text>

                <Text style={[styles.label, { color: colors.muted }]}>
                  Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Happy Hour, Early Bird"
                  placeholderTextColor={colors.muted + "80"}
                />

                <Text style={[styles.label, { color: colors.muted }]}>
                  Discount Percentage
                </Text>
                <View style={styles.percentRow}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        color: colors.foreground,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    value={percentage}
                    onChangeText={setPercentage}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={colors.muted + "80"}
                  />
                  <Text
                    style={[
                      styles.percentLabel,
                      { color: colors.foreground },
                    ]}
                  >
                    %
                  </Text>
                </View>

                <Text style={[styles.label, { color: colors.muted }]}>
                  Time Window
                </Text>
                <View style={styles.timeRow}>
                  <Pressable
                    onPress={() => setShowTimePicker("start")}
                    style={[
                      styles.timeBtn,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.foreground }}>
                      {formatTimeDisplay(startTime)}
                    </Text>
                  </Pressable>
                  <Text style={{ color: colors.muted, marginHorizontal: 8 }}>
                    to
                  </Text>
                  <Pressable
                    onPress={() => setShowTimePicker("end")}
                    style={[
                      styles.timeBtn,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.foreground }}>
                      {formatTimeDisplay(endTime)}
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.label, { color: colors.muted }]}>
                  Days of Week
                </Text>
                <View style={styles.daysRow}>
                  {DAYS_OF_WEEK.map((day) => (
                    <Pressable
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: selectedDays.includes(day)
                            ? colors.primary
                            : colors.background,
                          borderColor: selectedDays.includes(day)
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selectedDays.includes(day)
                            ? "#fff"
                            : colors.foreground,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {DAY_LABELS[day]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.muted }]}>
                  Applies To
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 16 }}
                >
                  <Pressable
                    onPress={() => setSelectedServiceIds(null)}
                    style={[
                      styles.serviceChip,
                      {
                        backgroundColor:
                          selectedServiceIds === null
                            ? colors.primary
                            : colors.background,
                        borderColor:
                          selectedServiceIds === null
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          selectedServiceIds === null
                            ? "#fff"
                            : colors.foreground,
                        fontSize: 13,
                      }}
                    >
                      All Services
                    </Text>
                  </Pressable>
                  {state.services.map((svc) => (
                    <Pressable
                      key={svc.id}
                      onPress={() => toggleServiceFilter(svc.id)}
                      style={[
                        styles.serviceChip,
                        {
                          backgroundColor:
                            selectedServiceIds?.includes(svc.id)
                              ? svc.color
                              : colors.background,
                          borderColor:
                            selectedServiceIds?.includes(svc.id)
                              ? svc.color
                              : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selectedServiceIds?.includes(svc.id)
                            ? "#fff"
                            : colors.foreground,
                          fontSize: 13,
                        }}
                      >
                        {svc.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.formActions}>
                  <Pressable
                    onPress={resetForm}
                    style={({ pressed }) => [
                      styles.formBtn,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    style={({ pressed }) => [
                      styles.formBtn,
                      { backgroundColor: colors.primary, flex: 1 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      {editingId ? "Update" : "Create"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker !== null} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTimePicker(null)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: colors.foreground }]}
            >
              Select {showTimePicker === "start" ? "Start" : "End"} Time
            </Text>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (showTimePicker === "start") setStartTime(item);
                    else setEndTime(item);
                    setShowTimePicker(null);
                  }}
                  style={({ pressed }) => [
                    styles.timeOption,
                    {
                      backgroundColor:
                        (showTimePicker === "start"
                          ? startTime
                          : endTime) === item
                          ? colors.primary + "20"
                          : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        (showTimePicker === "start"
                          ? startTime
                          : endTime) === item
                          ? colors.primary
                          : colors.foreground,
                      fontWeight:
                        (showTimePicker === "start"
                          ? startTime
                          : endTime) === item
                          ? "700"
                          : "400",
                      fontSize: 16,
                    }}
                  >
                    {formatTimeDisplay(item)}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardSubtitle: { fontSize: 14, marginTop: 2 },
  cardDetails: { gap: 6, marginBottom: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 13 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: { fontSize: 13, fontWeight: "600" },
  formCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  percentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  percentLabel: { fontSize: 18, fontWeight: "700" },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  timeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    width: "100%",
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  serviceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  formActions: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  formBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    minWidth: 80,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});
