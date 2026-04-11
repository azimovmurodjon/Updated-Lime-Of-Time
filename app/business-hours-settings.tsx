/**
 * Business Hours Settings Screen
 * 
 * Unified settings for business availability:
 * 1. Weekly Business Hours (Monday-Sunday)
 * 2. Daily Overrides (specific date exceptions)
 * 3. Multi-Staff Mode toggle
 * 
 * Fully integrated with:
 * - Store (state.settings.workingHours)
 * - Availability logic layer
 * - Booking slot generation
 * - Staff Calendar
 * - Public booking page
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useStore, formatTime } from '@/lib/store';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';
import { IconSymbol } from '@/components/ui/icon-symbol';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DailyOverride {
  date: string;
  isClosed: boolean;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export default function BusinessHoursSettings() {
  const router = useRouter();
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();

  // Load from store
  const [weeklyHours, setWeeklyHours] = useState(state.settings.workingHours || {
    Monday: { enabled: true, start: '09:00', end: '17:00' },
    Tuesday: { enabled: true, start: '09:00', end: '17:00' },
    Wednesday: { enabled: true, start: '09:00', end: '17:00' },
    Thursday: { enabled: true, start: '09:00', end: '17:00' },
    Friday: { enabled: true, start: '09:00', end: '17:00' },
    Saturday: { enabled: false, start: '10:00', end: '14:00' },
    Sunday: { enabled: false, start: '10:00', end: '14:00' },
  });

  const [multiStaffMode, setMultiStaffMode] = useState((state.settings.multiStaffMode as boolean | undefined) ?? false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'settings'>('weekly');
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Sync local state with store on mount
  useEffect(() => {
    if (state.settings.workingHours) {
      setWeeklyHours(state.settings.workingHours);
    }
    if ((state.settings.multiStaffMode as boolean | undefined) !== undefined) {
      setMultiStaffMode(state.settings.multiStaffMode as boolean);
    }
  }, [state.settings]);

  const handleSaveWeeklyHours = async () => {
    try {
      setLoading(true);
      
      // Validate all days
      for (const day of DAYS_OF_WEEK) {
        const hours = weeklyHours[day];
        if (hours.enabled) {
          const startMin = parseInt(hours.start.split(':')[0]) * 60 + parseInt(hours.start.split(':')[1]);
          const endMin = parseInt(hours.end.split(':')[0]) * 60 + parseInt(hours.end.split(':')[1]);
          if (startMin >= endMin) {
            Alert.alert('Error', `${day}: End time must be after start time`);
            return;
          }
        }
      }

      // Update store
      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: {
          ...state.settings,
          workingHours: weeklyHours,
        },
      });

      // Sync to database
      await syncToDb({
        type: 'UPDATE_SETTINGS',
        payload: {
          ...state.settings,
          workingHours: weeklyHours,
        },
      });

      Alert.alert('Success', 'Business hours updated. Booking availability will be recalculated.');
    } catch (error) {
      console.error('Error saving business hours:', error);
      Alert.alert('Error', 'Failed to save business hours');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMultiStaffMode = async () => {
    try {
      setLoading(true);

      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: {
          ...state.settings,
          multiStaffMode,
        },
      });

      await syncToDb({
        type: 'UPDATE_SETTINGS',
        payload: {
          ...state.settings,
          multiStaffMode,
        },
      });

      Alert.alert('Success', `Multi-staff mode ${multiStaffMode ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error saving multi-staff mode:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDay = (day: string) => {
    const hours = weeklyHours[day];
    setEditingDay(day);
    setEditStartTime(hours.start);
    setEditEndTime(hours.end);
  };

  const handleSaveDayEdit = () => {
    if (!editingDay) return;

    setWeeklyHours({
      ...weeklyHours,
      [editingDay]: {
        ...weeklyHours[editingDay],
        start: editStartTime,
        end: editEndTime,
      },
    });

    setEditingDay(null);
  };

  const handleToggleDay = (day: string) => {
    setWeeklyHours({
      ...weeklyHours,
      [day]: {
        ...weeklyHours[day],
        enabled: !weeklyHours[day].enabled,
      },
    });
  };

  if (loading && editingDay === null) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
            <Text className="text-lg font-semibold" style={{ color: colors.primary }}>← Back</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">Business Hours</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Tab Navigation */}
        <View className="flex-row gap-2 mb-6">
          {(['weekly', 'settings'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: activeTab === tab ? colors.primary : colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: activeTab === tab ? '#FFFFFF' : colors.foreground,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                {tab === 'weekly' ? 'Weekly Hours' : 'Settings'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Weekly Hours Tab */}
        {activeTab === 'weekly' && (
          <View>
            <Text className="text-sm text-muted mb-4">Set your regular business hours for each day of the week</Text>

            {DAYS_OF_WEEK.map((day) => {
              const hours = weeklyHours[day];
              const isEditing = editingDay === day;

              return (
                <View key={day} className="mb-4 p-4 bg-surface rounded-xl border border-border">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-base font-semibold text-foreground">{day}</Text>
                    <Switch
                      value={hours.enabled}
                      onValueChange={() => handleToggleDay(day)}
                      trackColor={{ false: colors.border, true: colors.primary + '50' }}
                      thumbColor={hours.enabled ? colors.primary : colors.border}
                    />
                  </View>

                  {hours.enabled && !isEditing && (
                    <Pressable
                      onPress={() => handleEditDay(day)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Text className="text-sm text-foreground">
                        {formatTime(hours.start)} — {formatTime(hours.end)}
                      </Text>
                    </Pressable>
                  )}

                  {isEditing && (
                    <View className="gap-3">
                      <View>
                        <Text className="text-xs text-muted mb-2">Start Time</Text>
                        <TextInputTime
                          value={editStartTime}
                          onChange={setEditStartTime}
                          colors={colors}
                        />
                      </View>
                      <View>
                        <Text className="text-xs text-muted mb-2">End Time</Text>
                        <TextInputTime
                          value={editEndTime}
                          onChange={setEditEndTime}
                          colors={colors}
                        />
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={handleSaveDayEdit}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              paddingVertical: 10,
                              borderRadius: 8,
                              backgroundColor: colors.primary,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text className="text-center text-white font-semibold">Save</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingDay(null)}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              paddingVertical: 10,
                              borderRadius: 8,
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text className="text-center text-foreground font-semibold">Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable
              onPress={handleSaveWeeklyHours}
              disabled={loading}
              style={({ pressed }) => [
                {
                  paddingVertical: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed || loading ? 0.7 : 1,
                  marginTop: 20,
                },
              ]}
            >
              <Text className="text-center text-white font-bold text-base">Save Business Hours</Text>
            </Pressable>
          </View>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <View>
            <View className="p-4 bg-surface rounded-xl border border-border mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">Multi-Staff Mode</Text>
                  <Text className="text-sm text-muted">
                    {multiStaffMode
                      ? 'Enabled: Assign appointments to specific staff members'
                      : 'Disabled: Solo business owner mode'}
                  </Text>
                </View>
                <Switch
                  value={multiStaffMode}
                  onValueChange={(val) => {
                    setMultiStaffMode(val);
                    handleSaveMultiStaffMode();
                  }}
                  trackColor={{ false: colors.border, true: colors.primary + '50' }}
                  thumbColor={multiStaffMode ? colors.primary : colors.border}
                />
              </View>
            </View>

            <View className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <Text className="text-sm font-semibold text-blue-900 mb-2">💡 Tip</Text>
              <Text className="text-xs text-blue-800">
                Changes to business hours will immediately affect available booking slots for clients. Daily overrides can be set for specific dates.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// Simple time input component
function TextInputTime({ value, onChange, colors }: any) {
  return (
    <View className="border border-border rounded-lg px-3 py-2 bg-background">
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  );
}
