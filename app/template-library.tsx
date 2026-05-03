import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  TEMPLATE_LIBRARY,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
  ReminderTemplate,
} from "@/lib/types";

const CATEGORY_ORDER: TemplateCategory[] = [
  "upcoming",
  "confirmed",
  "pending",
  "cancelled",
  "completed",
  "no_show",
  "reschedule",
];

export default function TemplateLibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ onSelectId?: string; filterCategory?: string }>();
  const { state, dispatch } = useStore();

  // Which categories are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORY_ORDER.map((c) => [c, true]))
  );

  const savedIds = useMemo(
    () => new Set((state.reminderTemplates ?? []).map((t) => t.id)),
    [state.reminderTemplates]
  );

  // If opened from Send Reminder, filter to relevant categories
  const filterCategory = params.filterCategory as TemplateCategory | undefined;
  const visibleCategories = filterCategory
    ? CATEGORY_ORDER.filter((c) => c === filterCategory || !filterCategory)
    : CATEGORY_ORDER;

  const grouped = useMemo(() => {
    return visibleCategories.map((cat) => ({
      cat,
      templates: TEMPLATE_LIBRARY.filter((t) => t.category === cat),
    }));
  }, [visibleCategories]);

  function toggleCategory(cat: string) {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  function handleAdd(template: ReminderTemplate) {
    const alreadySaved = savedIds.has(template.id);
    if (alreadySaved) {
      // If opened from Send Reminder, just go back with selection
      if (params.onSelectId !== undefined) {
        router.back();
        // Pass selected id via router params on the way back
        router.setParams({ selectedLibraryId: template.id });
      }
      return;
    }

    const toSave: ReminderTemplate = {
      ...template,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_REMINDER_TEMPLATE", payload: toSave });

    if (params.onSelectId !== undefined) {
      // Navigate back and signal which template was selected
      router.back();
      router.setParams({ selectedLibraryId: template.id });
    } else {
      Alert.alert("Template Added", `"${template.label}" has been added to your templates.`);
    }
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScreenContainer>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={20} color={colors.primary} />
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.headerTitle}>Template Library</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.subtitle}>
          Browse 49 professional SMS templates organized by category. Tap{" "}
          <Text style={{ color: colors.primary }}>Add to My Templates</Text> to save a template for use in Send Reminder.
        </Text>

        {grouped.map(({ cat, templates }) => (
          <View key={cat} style={s.section}>
            <Pressable style={s.sectionHeader} onPress={() => toggleCategory(cat)}>
              <View style={s.sectionHeaderLeft}>
                <View style={[s.categoryDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                <Text style={s.sectionTitle}>{TEMPLATE_CATEGORY_LABELS[cat]}</Text>
                <View style={s.countBadge}>
                  <Text style={s.countText}>{templates.length}</Text>
                </View>
              </View>
              <IconSymbol
                name={expanded[cat] ? "chevron.down" : "chevron.right"}
                size={16}
                color={colors.muted}
              />
            </Pressable>

            {expanded[cat] && (
              <View style={s.templateList}>
                {templates.map((tmpl) => {
                  const isSaved = savedIds.has(tmpl.id);
                  return (
                    <View key={tmpl.id} style={s.templateCard}>
                      <View style={s.templateTop}>
                        <Text style={s.templateLabel}>{tmpl.label}</Text>
                        {tmpl.minutesBefore > 0 && (
                          <View style={s.timingBadge}>
                            <Text style={s.timingText}>{formatMinutes(tmpl.minutesBefore)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.templatePreview} numberOfLines={3}>
                        {tmpl.customMessage}
                      </Text>
                      <Pressable
                        style={[s.addBtn, isSaved && s.addBtnSaved]}
                        onPress={() => handleAdd(tmpl)}
                      >
                        <IconSymbol
                          name={isSaved ? "checkmark" : "plus"}
                          size={14}
                          color={isSaved ? colors.success : colors.primary}
                        />
                        <Text style={[s.addBtnText, isSaved && s.addBtnTextSaved]}>
                          {isSaved ? "Added to My Templates" : "Add to My Templates"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function formatMinutes(min: number): string {
  if (min >= 1440) return `${min / 1440}d before`;
  if (min >= 60) return `${min / 60}h before`;
  return `${min}m before`;
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  upcoming:   "#3B82F6",
  confirmed:  "#22C55E",
  pending:    "#F59E0B",
  cancelled:  "#EF4444",
  completed:  "#8B5CF6",
  no_show:    "#F97316",
  reschedule: "#06B6D4",
};

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      width: 60,
    },
    backText: {
      fontSize: 16,
      color: colors.primary,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.foreground,
    },
    scroll: {
      padding: 16,
      gap: 12,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      lineHeight: 20,
      marginBottom: 8,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
    },
    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    categoryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    countBadge: {
      backgroundColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    countText: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: "500",
    },
    templateList: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    templateCard: {
      padding: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 6,
    },
    templateTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    templateLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
      flex: 1,
    },
    timingBadge: {
      backgroundColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    timingText: {
      fontSize: 11,
      color: colors.muted,
    },
    templatePreview: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginTop: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    addBtnSaved: {
      borderColor: colors.success,
      backgroundColor: `${colors.success}15`,
    },
    addBtnText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: "500",
    },
    addBtnTextSaved: {
      color: colors.success,
    },
  });
}
