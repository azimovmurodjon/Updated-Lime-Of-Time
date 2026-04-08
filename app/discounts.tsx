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
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useCallback, useMemo } from "react";
import {
  Discount,
  formatTimeDisplay,
  generateAllTimeOptions,
} from "@/lib/types";

const TIME_OPTIONS = generateAllTimeOptions();
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DiscountsScreen() {
  const { state, dispatch, syncToDb, getServiceById } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[] | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[] | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<"start" | "end" | null>(null);

  // Calendar state
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const calDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const nextMonth = useCallback(() => {
    setCalMonth((m) => {
      if (m === 11) { setCalYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);
  const prevMonth = useCallback(() => {
    const now = new Date();
    if (calYear === now.getFullYear() && calMonth <= now.getMonth()) return;
    setCalMonth((m) => {
      if (m === 0) { setCalYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, [calYear, calMonth]);

  const toggleDate = useCallback((dateStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  }, []);

  const resetForm = useCallback(() => {
    setName("");
    setPercentage("10");
    setStartTime("09:00");
    setEndTime("12:00");
    setSelectedDates([]);
    setSelectedServiceIds(null);
    setSelectedProductIds(null);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const handleEdit = useCallback((disc: Discount) => {
    setEditingId(disc.id);
    setName(disc.name);
    setPercentage(String(disc.percentage));
    setStartTime(disc.startTime);
    setEndTime(disc.endTime);
    setSelectedDates(disc.dates ?? []);
    setSelectedServiceIds(disc.serviceIds);
    setSelectedProductIds(disc.productIds ?? null);
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
    if (selectedDates.length === 0) {
      Alert.alert("Required", "Please select at least one date for this discount.");
      return;
    }

    if (editingId) {
      const updated: Discount = {
        id: editingId,
        name: name.trim(),
        percentage: pct,
        startTime,
        endTime,
        daysOfWeek: [],
        dates: selectedDates,
        serviceIds: selectedServiceIds,
        productIds: selectedProductIds,
        active: state.discounts.find((d) => d.id === editingId)?.active ?? true,
        createdAt: state.discounts.find((d) => d.id === editingId)?.createdAt ?? new Date().toISOString(),
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
        daysOfWeek: [],
        dates: selectedDates,
        serviceIds: selectedServiceIds,
        productIds: selectedProductIds,
        active: true,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_DISCOUNT", payload: newDiscount });
      syncToDb({ type: "ADD_DISCOUNT", payload: newDiscount });
    }
    resetForm();
  }, [name, percentage, startTime, endTime, selectedDates, selectedServiceIds, selectedProductIds, editingId, state.discounts, dispatch, syncToDb, resetForm]);

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

  const toggleServiceFilter = useCallback((serviceId: string) => {
    setSelectedServiceIds((prev) => {
      if (!prev) return [serviceId];
      if (prev.includes(serviceId)) {
        const next = prev.filter((id) => id !== serviceId);
        return next.length === 0 ? null : next;
      }
      return [...prev, serviceId];
    });
  }, []);

  const toggleProductFilter = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      if (!prev) return [productId];
      if (prev.includes(productId)) {
        const next = prev.filter((id) => id !== productId);
        return next.length === 0 ? null : next;
      }
      return [...prev, productId];
    });
  }, []);

  const availableProducts = useMemo(
    () => state.products.filter((p) => p.available),
    [state.products]
  );

  const sortedDiscounts = useMemo(
    () => [...state.discounts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.discounts]
  );

  const renderDiscount = useCallback(
    ({ item }: { item: Discount }) => {
      const serviceNames =
        item.serviceIds && item.serviceIds.length > 0
          ? item.serviceIds.map((id) => getServiceById(id)?.name ?? "Unknown").join(", ")
          : "All Services";
      const productNames =
        item.productIds && item.productIds.length > 0
          ? item.productIds.map((id) => state.products.find((p) => p.id === id)?.name ?? "Unknown").join(", ")
          : item.productIds === null ? "All Products" : "No Products";
      const dateLabels = (item.dates ?? []).length > 0
        ? (item.dates ?? []).slice(0, 3).map(formatDateLabel).join(", ") + ((item.dates ?? []).length > 3 ? ` +${(item.dates ?? []).length - 3} more` : "")
        : "No dates selected";

      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.active ? 1 : 0.6 }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.primary }]}>{item.percentage}% off</Text>
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
                {formatTimeDisplay(item.startTime)} – {formatTimeDisplay(item.endTime)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={14} color={colors.muted} />
              <Text style={[styles.detailText, { color: colors.muted }]} numberOfLines={1}>{dateLabels}</Text>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="list.bullet" size={14} color={colors.muted} />
              <Text style={[styles.detailText, { color: colors.muted }]} numberOfLines={1}>Services: {serviceNames}</Text>
            </View>
            {(item.productIds === null || (item.productIds && item.productIds.length > 0)) && (
              <View style={styles.detailRow}>
                <IconSymbol name="bag.fill" size={14} color={colors.muted} />
                <Text style={[styles.detailText, { color: colors.muted }]} numberOfLines={1}>Products: {productNames}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardActions}>
            <Pressable
              onPress={() => handleEdit(item)}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary + "15" }, pressed && { opacity: 0.7 }]}
            >
              <IconSymbol name="pencil" size={16} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDelete(item.id)}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error + "15" }, pressed && { opacity: 0.7 }]}
            >
              <IconSymbol name="trash.fill" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [colors, getServiceById, state.products, handleEdit, handleDelete, handleToggleActive]
  );

  const formContent = showForm ? (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.formTitle, { color: colors.foreground }]}>
        {editingId ? "Edit Discount" : "New Discount"}
      </Text>

      {/* Name */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Discount Name</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Happy Hour, Early Bird"
        placeholderTextColor={colors.muted + "80"}
      />

      {/* Percentage */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Discount Percentage</Text>
      <View style={styles.percentRow}>
        <TextInput
          style={[styles.input, { flex: 1, color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, marginBottom: 0 }]}
          value={percentage}
          onChangeText={setPercentage}
          keyboardType="number-pad"
          placeholder="10"
          placeholderTextColor={colors.muted + "80"}
        />
        <View style={[styles.percentBadge, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.percentLabel, { color: colors.primary }]}>%</Text>
        </View>
      </View>

      {/* Time Window */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Time Window</Text>
      <View style={styles.timeRow}>
        <Pressable
          onPress={() => setShowTimePicker("start")}
          style={[styles.timeBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <IconSymbol name="clock.fill" size={14} color={colors.primary} />
          <Text style={[styles.timeBtnText, { color: colors.foreground }]}>{formatTimeDisplay(startTime)}</Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>to</Text>
        <Pressable
          onPress={() => setShowTimePicker("end")}
          style={[styles.timeBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <IconSymbol name="clock.fill" size={14} color={colors.primary} />
          <Text style={[styles.timeBtnText, { color: colors.foreground }]}>{formatTimeDisplay(endTime)}</Text>
        </Pressable>
      </View>

      {/* Calendar Date Picker */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Select Dates (future only)</Text>
      <View style={[styles.calendarCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {/* Month Navigation */}
        <View style={styles.calNavRow}>
          <Pressable onPress={prevMonth} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.5 }]}>
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.calMonthTitle, { color: colors.foreground }]}>
            {MONTH_NAMES[calMonth]} {calYear}
          </Text>
          <Pressable onPress={nextMonth} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.5 }]}>
            <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Weekday Headers */}
        <View style={styles.calWeekRow}>
          {WEEKDAY_HEADERS.map((d) => (
            <Text key={d} style={[styles.calDayHeader, { color: colors.muted }]}>{d}</Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calGrid}>
          {calDays.map((day, idx) => {
            if (day === null) return <View key={`e-${idx}`} style={styles.calCell} />;
            const dateStr = toDateStr(calYear, calMonth, day);
            const isPast = dateStr < todayStr;
            const isSelected = selectedDates.includes(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <Pressable
                key={dateStr}
                onPress={() => !isPast && toggleDate(dateStr)}
                style={[
                  styles.calCell,
                  isSelected && { backgroundColor: colors.primary, borderRadius: 20 },
                  isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 20 },
                ]}
                disabled={isPast}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: isSelected || isToday ? "700" : "400",
                    color: isPast ? colors.muted + "40" : isSelected ? "#fff" : colors.foreground,
                    lineHeight: 20,
                  }}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Selected dates summary */}
        {selectedDates.length > 0 && (
          <View style={styles.selectedSummary}>
            <Text style={[styles.selectedCount, { color: colors.primary }]}>
              {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
            </Text>
            <Pressable onPress={() => setSelectedDates([])} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>Clear All</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Service Filter */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Applies To (Services)</Text>
      <View style={styles.serviceWrap}>
        <Pressable
          onPress={() => setSelectedServiceIds(null)}
          style={[
            styles.serviceChip,
            {
              backgroundColor: selectedServiceIds === null ? colors.primary : colors.background,
              borderColor: selectedServiceIds === null ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={{ color: selectedServiceIds === null ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>
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
                backgroundColor: selectedServiceIds?.includes(svc.id) ? svc.color : colors.background,
                borderColor: selectedServiceIds?.includes(svc.id) ? svc.color : colors.border,
              },
            ]}
          >
            <Text style={{ color: selectedServiceIds?.includes(svc.id) ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>
              {svc.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Product Filter */}
      {availableProducts.length > 0 && (
        <>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Applies To (Products)</Text>
          <View style={styles.serviceWrap}>
            <Pressable
              onPress={() => setSelectedProductIds(null)}
              style={[
                styles.serviceChip,
                {
                  backgroundColor: selectedProductIds === null ? colors.primary : colors.background,
                  borderColor: selectedProductIds === null ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: selectedProductIds === null ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>
                All Products
              </Text>
            </Pressable>
            {availableProducts.map((prod) => (
              <Pressable
                key={prod.id}
                onPress={() => toggleProductFilter(prod.id)}
                style={[
                  styles.serviceChip,
                  {
                    backgroundColor: selectedProductIds?.includes(prod.id) ? colors.primary : colors.background,
                    borderColor: selectedProductIds?.includes(prod.id) ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: selectedProductIds?.includes(prod.id) ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>
                  {prod.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Actions */}
      <View style={styles.formActions}>
        <Pressable
          onPress={resetForm}
          style={({ pressed }) => [styles.formBtnCancel, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, lineHeight: 20 }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.formBtnSave, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14, lineHeight: 20 }}>
            {editingId ? "Update" : "Create"}
          </Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.6 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Discounts</Text>
        <Pressable
          onPress={() => { resetForm(); setShowForm(true); }}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {sortedDiscounts.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <IconSymbol name="tag.fill" size={48} color={colors.muted + "40"} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Discounts Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Create date-based discounts to attract more clients during specific hours.
          </Text>
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.emptyBtnText}>Create Discount</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedDiscounts}
          keyExtractor={(item) => item.id}
          renderItem={renderDiscount}
          contentContainerStyle={{ paddingHorizontal: hp, paddingTop: 16, paddingBottom: 100 }}
          ListHeaderComponent={formContent}
        />
      )}

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimePicker(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Select {showTimePicker === "start" ? "Start" : "End"} Time
              </Text>
              <Pressable onPress={() => setShowTimePicker(null)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => {
                const isActive = (showTimePicker === "start" ? startTime : endTime) === item;
                return (
                  <Pressable
                    onPress={() => {
                      if (showTimePicker === "start") setStartTime(item);
                      else setEndTime(item);
                      setShowTimePicker(null);
                    }}
                    style={[
                      styles.timePickerItem,
                      { backgroundColor: isActive ? colors.primary + "15" : "transparent", borderColor: isActive ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={{ color: isActive ? colors.primary : colors.foreground, fontWeight: isActive ? "700" : "400", fontSize: 15, lineHeight: 20 }}>
                      {formatTimeDisplay(item)}
                    </Text>
                    {isActive && <IconSymbol name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
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
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    gap: 12,
    width: "100%",
  },
  headerBackBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700", flex: 1, lineHeight: 26 },
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
  emptyTitle: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, lineHeight: 20 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    width: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    width: "100%",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", lineHeight: 22 },
  cardSubtitle: { fontSize: 14, marginTop: 2, fontWeight: "600", lineHeight: 18 },
  cardDetails: { gap: 8, marginBottom: 14, width: "100%" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 13, lineHeight: 18, flex: 1 },
  cardActions: { flexDirection: "row", gap: 8, width: "100%" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 40,
  },
  actionText: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16, lineHeight: 24 },
  fieldLabel: { fontSize: 12, fontWeight: "500", marginBottom: 6, marginTop: 8 },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  percentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
    width: "100%",
  },
  percentBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  percentLabel: { fontSize: 18, fontWeight: "700" },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    width: "100%",
  },
  timeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  timeBtnText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  calendarCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    width: "100%",
  },
  calNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    width: "100%",
  },
  calNavBtn: { padding: 4 },
  calMonthTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  calWeekRow: { flexDirection: "row", marginBottom: 4, width: "100%" },
  calDayHeader: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600" },
  calGrid: { flexDirection: "row", flexWrap: "wrap", width: "100%" },
  calCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  selectedSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    width: "100%",
  },
  selectedCount: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  serviceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    width: "100%",
  },
  serviceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  formActions: { flexDirection: "row", gap: 10, marginTop: 8, width: "100%" },
  formBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  formBtnSave: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    width: "100%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  timePickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
    height: 48,
  },
});
