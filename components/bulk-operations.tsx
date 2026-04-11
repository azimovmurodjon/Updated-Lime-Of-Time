import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import * as Haptics from 'expo-haptics';

interface BulkOperationsProps {
  onSuccess?: () => void;
}

/**
 * Bulk operations for staff schedule management
 * - Copy schedule to all staff
 * - Apply override to recurring dates
 */
export function BulkOperations({ onSuccess }: BulkOperationsProps) {
  const [showModal, setShowModal] = useState(false);
  const [operation, setOperation] = useState<'copy' | 'recurring' | null>(null);
  const [loading, setLoading] = useState(false);
  const { state, dispatch } = useStore();

  const handleCopyScheduleToAllStaff = async () => {
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Bulk copy operations are handled at the server level
      Alert.alert(
        'Info',
        'Copy schedule feature will be available in the next update.'
      );
      setShowModal(false);
      onSuccess?.();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to copy schedule');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecurringOverride = async () => {
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Bulk operations are handled at the server level
      // This is a placeholder for future implementation
      Alert.alert(
        'Info',
        'Bulk operations will be available in the next update. For now, please update schedules individually.'
      );
      return;

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      Alert.alert(
        'Success',
        'Recurring override feature will be available in the next update.'
      );
      setShowModal(false);
      onSuccess?.();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to apply recurring override');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bulk Operations Button */}
      <Pressable
        onPress={() => setShowModal(true)}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        className="bg-blue-500 px-4 py-2 rounded-lg"
      >
        <Text className="text-white font-semibold text-center">
          Bulk Operations
        </Text>
      </Pressable>

      {/* Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-2xl p-6 max-h-96">
            <Text className="text-2xl font-bold text-foreground mb-4">
              Bulk Operations
            </Text>

            <ScrollView className="gap-3">
              {/* Copy Schedule to All Staff */}
              <Pressable
                onPress={handleCopyScheduleToAllStaff}
                disabled={loading}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="bg-blue-100 p-4 rounded-lg border border-blue-300"
              >
                <Text className="text-lg font-semibold text-blue-600">
                  📋 Copy Schedule to All Staff
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Copy the selected staff member's schedule to all other staff
                  members
                </Text>
              </Pressable>

              {/* Apply Override to Recurring Dates */}
              <Pressable
                onPress={handleApplyRecurringOverride}
                disabled={loading}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="bg-amber-100 p-4 rounded-lg border border-amber-300"
              >
                <Text className="text-lg font-semibold text-amber-600">
                  📅 Apply Override to Recurring Dates
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Apply the last created override to the next 30 days
                </Text>
              </Pressable>

              {/* Close Button */}
              <Pressable
                onPress={() => setShowModal(false)}
                disabled={loading}
                className="bg-gray-200 p-3 rounded-lg mt-4"
              >
                <Text className="text-center font-semibold text-foreground">
                  Close
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

/**
 * Bulk operations confirmation dialog
 */
export function BulkOperationsConfirmation({
  visible,
  operation,
  count,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  operation: string;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="bg-background rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-xl font-bold text-foreground mb-2">
            Confirm Bulk Operation
          </Text>
          <Text className="text-muted mb-6">
            {operation} will affect {count} items. This action cannot be undone.
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 bg-gray-200 p-3 rounded-lg"
            >
              <Text className="text-center font-semibold text-foreground">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              className="flex-1 bg-red-500 p-3 rounded-lg"
            >
              <Text className="text-center font-semibold text-white">
                Confirm
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
