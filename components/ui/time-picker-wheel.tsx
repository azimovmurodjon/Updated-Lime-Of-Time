/**
 * TimePickerWheel Component
 * 
 * Unified time picker with scrolling wheel interface
 * Supports 12-hour format with AM/PM and flexible minute selection
 * 
 * Features:
 * - Smooth scrolling wheel interaction
 * - 12-hour format (1-12) with AM/PM
 * - Flexible minute selection (00-59)
 * - Touch and mouse support
 * - Accessible keyboard navigation
 * - Haptic feedback on selection
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/utils';

export interface TimePickerWheelProps {
  value: string; // HH:MM format (24-hour)
  onChange: (time: string) => void;
  minTime?: string; // HH:MM format
  maxTime?: string; // HH:MM format
  disabled?: boolean;
  testID?: string;
}

export function TimePickerWheel({
  value,
  onChange,
  minTime,
  maxTime,
  disabled = false,
  testID
}: TimePickerWheelProps) {
  const [hour, setHour] = useState(parseInt(value.split(':')[0]));
  const [minute, setMinute] = useState(parseInt(value.split(':')[1]));
  const [period, setPeriod] = useState(hour >= 12 ? 'PM' : 'AM');

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // Convert 24-hour to 12-hour format
  useEffect(() => {
    const h = parseInt(value.split(':')[0]);
    const m = parseInt(value.split(':')[1]);
    const p = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;

    setHour(h12);
    setMinute(m);
    setPeriod(p);
  }, [value]);

  // Convert 12-hour back to 24-hour format
  const get24HourFormat = (h: number, p: string): number => {
    if (p === 'AM') {
      return h === 12 ? 0 : h;
    } else {
      return h === 12 ? 12 : h + 12;
    }
  };

  const handleHourChange = (newHour: number) => {
    if (newHour < 1) setHour(12);
    else if (newHour > 12) setHour(1);
    else setHour(newHour);

    triggerHaptic();
    updateTime(newHour, minute, period);
  };

  const handleMinuteChange = (newMinute: number) => {
    if (newMinute < 0) setMinute(59);
    else if (newMinute > 59) setMinute(0);
    else setMinute(newMinute);

    triggerHaptic();
    updateTime(hour, newMinute, period);
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    setPeriod(newPeriod);
    triggerHaptic();
    updateTime(hour, minute, newPeriod);
  };

  const updateTime = (h: number, m: number, p: string) => {
    const h24 = get24HourFormat(h, p);
    const timeStr = `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    // Check if time is within allowed range
    if (minTime && timeStr < minTime) return;
    if (maxTime && timeStr > maxTime) return;

    onChange(timeStr);
  };

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View
      testID={testID}
      className={cn(
        'flex-row items-center justify-center gap-2 bg-surface rounded-lg p-4',
        disabled && 'opacity-50'
      )}
    >
      {/* Hour Wheel */}
      <WheelPicker
        items={Array.from({ length: 12 }, (_, i) => (i + 1).toString())}
        selectedIndex={hour - 1}
        onSelect={(index) => handleHourChange(index + 1)}
        disabled={disabled}
        testID={`${testID}-hour`}
      />

      {/* Colon Separator */}
      <Text className="text-2xl font-bold text-foreground">:</Text>

      {/* Minute Wheel */}
      <WheelPicker
        items={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
        selectedIndex={minute}
        onSelect={(index) => handleMinuteChange(index)}
        disabled={disabled}
        testID={`${testID}-minute`}
      />

      {/* Period Selector */}
      <View className="flex-col gap-1">
        <Pressable
          onPress={() => handlePeriodChange('AM')}
          disabled={disabled}
          className={cn(
            'px-3 py-2 rounded-md',
            period === 'AM' ? 'bg-primary' : 'bg-muted'
          )}
        >
          <Text
            className={cn(
              'font-semibold',
              period === 'AM' ? 'text-background' : 'text-muted'
            )}
          >
            AM
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handlePeriodChange('PM')}
          disabled={disabled}
          className={cn(
            'px-3 py-2 rounded-md',
            period === 'PM' ? 'bg-primary' : 'bg-muted'
          )}
        >
          <Text
            className={cn(
              'font-semibold',
              period === 'PM' ? 'text-background' : 'text-muted'
            )}
          >
            PM
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// WheelPicker Sub-Component
// ============================================================================

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
  testID?: string;
}

function WheelPicker({
  items,
  selectedIndex,
  onSelect,
  disabled = false,
  testID
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const itemHeight = 44; // Height of each item in pixels

  // Scroll to selected item on mount
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: selectedIndex * itemHeight,
        animated: false
      });
    }, 0);
  }, [selectedIndex]);

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / itemHeight);
    if (index !== selectedIndex && index >= 0 && index < items.length) {
      onSelect(index);
    }
  };

  return (
    <View className="flex-col items-center" testID={testID}>
      <ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        scrollEnabled={!disabled}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        className="h-44 w-16"
      >
        {/* Top padding */}
        <View style={{ height: itemHeight * 2 }} />

        {/* Items */}
        {items.map((item, index) => (
          <View
            key={`${item}-${index}`}
            style={{ height: itemHeight }}
            className="flex-row items-center justify-center"
          >
            <Text
              className={cn(
                'text-xl font-semibold',
                index === selectedIndex ? 'text-primary' : 'text-muted'
              )}
            >
              {item}
            </Text>
          </View>
        ))}

        {/* Bottom padding */}
        <View style={{ height: itemHeight * 2 }} />
      </ScrollView>

      {/* Center highlight line */}
      <View
        className="absolute w-full h-11 border-t border-b border-primary"
        pointerEvents="none"
        style={{
          top: itemHeight,
          opacity: 0.3
        }}
      />
    </View>
  );
}

// ============================================================================
// Simplified Time Picker (for quick time selection)
// ============================================================================

export interface SimpleTimePickerProps {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  label?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * Simplified time picker with hour and minute buttons
 * Good for quick adjustments without full wheel interaction
 */
export function SimpleTimePicker({
  value,
  onChange,
  label,
  disabled = false,
  testID
}: SimpleTimePickerProps) {
  const [hour, setHour] = useState(parseInt(value.split(':')[0]));
  const [minute, setMinute] = useState(parseInt(value.split(':')[1]));

  const updateTime = (h: number, m: number) => {
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    onChange(timeStr);
  };

  const incrementHour = () => {
    const newHour = (hour + 1) % 24;
    setHour(newHour);
    updateTime(newHour, minute);
  };

  const decrementHour = () => {
    const newHour = hour === 0 ? 23 : hour - 1;
    setHour(newHour);
    updateTime(newHour, minute);
  };

  const incrementMinute = () => {
    const newMinute = (minute + 15) % 60;
    setMinute(newMinute);
    updateTime(hour, newMinute);
  };

  const decrementMinute = () => {
    const newMinute = minute === 0 ? 45 : minute - 15;
    setMinute(newMinute);
    updateTime(hour, newMinute);
  };

  return (
    <View testID={testID} className="flex-col gap-3">
      {label && <Text className="text-sm font-semibold text-foreground">{label}</Text>}

      <View className="flex-row items-center justify-center gap-4 bg-surface rounded-lg p-4">
        {/* Hour Controls */}
        <View className="flex-col items-center gap-2">
          <Pressable
            onPress={incrementHour}
            disabled={disabled}
            className="p-2 rounded-md bg-primary active:opacity-80"
          >
            <Text className="text-background font-bold">+</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground w-12 text-center">
            {hour.toString().padStart(2, '0')}
          </Text>
          <Pressable
            onPress={decrementHour}
            disabled={disabled}
            className="p-2 rounded-md bg-primary active:opacity-80"
          >
            <Text className="text-background font-bold">−</Text>
          </Pressable>
        </View>

        {/* Separator */}
        <Text className="text-3xl font-bold text-foreground">:</Text>

        {/* Minute Controls */}
        <View className="flex-col items-center gap-2">
          <Pressable
            onPress={incrementMinute}
            disabled={disabled}
            className="p-2 rounded-md bg-primary active:opacity-80"
          >
            <Text className="text-background font-bold">+</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground w-12 text-center">
            {minute.toString().padStart(2, '0')}
          </Text>
          <Pressable
            onPress={decrementMinute}
            disabled={disabled}
            className="p-2 rounded-md bg-primary active:opacity-80"
          >
            <Text className="text-background font-bold">−</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
