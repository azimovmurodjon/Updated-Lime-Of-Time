import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

export interface CalendarDayIndicatorProps {
  date: Date;
  hasOverride?: boolean;
  hasStaffUnavailability?: boolean;
  isAvailable?: boolean;
  isSelected?: boolean;
  isPast?: boolean;
}

/**
 * Calendar day indicator with visual feedback for availability status
 * - Green dot: Available slots
 * - Orange dot: Daily override (custom hours)
 * - Red dot: Staff unavailable
 * - Gray: Past date or no availability
 */
export function CalendarDayIndicator({
  date,
  hasOverride = false,
  hasStaffUnavailability = false,
  isAvailable = true,
  isSelected = false,
  isPast = false,
}: CalendarDayIndicatorProps) {
  // Determine indicator color based on status
  let indicatorColor = 'bg-gray-300'; // Default: no availability
  let indicatorLabel = 'No availability';

  if (isPast) {
    indicatorColor = 'bg-gray-300';
    indicatorLabel = 'Past date';
  } else if (hasStaffUnavailability) {
    indicatorColor = 'bg-red-500';
    indicatorLabel = 'Staff unavailable';
  } else if (hasOverride) {
    indicatorColor = 'bg-amber-500';
    indicatorLabel = 'Custom hours';
  } else if (isAvailable) {
    indicatorColor = 'bg-green-500';
    indicatorLabel = 'Available';
  }

  return (
    <View
      className={cn(
        'relative w-full h-full items-center justify-center',
        isSelected && 'bg-blue-100 rounded-lg'
      )}
      accessible={true}
      accessibilityLabel={`${date.getDate()} - ${indicatorLabel}`}
      accessibilityRole="button"
    >
      {/* Day number */}
      <Text
        className={cn(
          'text-center font-semibold',
          isSelected ? 'text-blue-600' : 'text-foreground'
        )}
      >
        {date.getDate()}
      </Text>

      {/* Status indicator dot */}
      <View
        className={cn(
          'absolute bottom-1 w-2 h-2 rounded-full',
          indicatorColor
        )}
        accessible={false}
      />

      {/* Tooltip on hover (web only) */}
      <View
        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
        accessible={false}
      >
        <Text className="text-white text-xs">{indicatorLabel}</Text>
      </View>
    </View>
  );
}

/**
 * Legend showing what each indicator color means
 */
export function CalendarIndicatorLegend() {
  const indicators = [
    { color: 'bg-green-500', label: 'Available slots' },
    { color: 'bg-amber-500', label: 'Custom hours' },
    { color: 'bg-red-500', label: 'Staff unavailable' },
    { color: 'bg-gray-300', label: 'No availability' },
  ];

  return (
    <View className="flex-row flex-wrap gap-4 p-4 bg-surface rounded-lg">
      {indicators.map((item) => (
        <View key={item.label} className="flex-row items-center gap-2">
          <View className={cn('w-3 h-3 rounded-full', item.color)} />
          <Text className="text-xs text-muted">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
