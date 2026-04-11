/**
 * Booking Availability Integration
 * 
 * Integrates the unified availability system with the booking flow.
 * Used by both app booking and public booking page.
 */

import {
  getBusinessHoursForDate,
  isBusinessOpenOnDate,
  isDateTimeAvailable,
  getAvailableTimeSlots,
  isStaffAvailableAtTime,
  TimeSlot,
  AvailableSlot,
} from './availability';

/**
 * Get available time slots for a specific date and service
 * 
 * @param businessId - Business owner ID
 * @param date - Date to check (YYYY-MM-DD format)
 * @param serviceId - Service ID (optional, for service-specific duration)
 * @param serviceDurationMinutes - Service duration in minutes (default: 60)
 * @returns Array of available time slots in HH:MM format
 */
export async function getBookingTimeSlots(
  businessId: number,
  date: string,
  serviceDurationMinutes: number = 60,
  staffId?: string
): Promise<AvailableSlot[]> {
  try {
    // Check if business is open on this date
    const isOpen = await isBusinessOpenOnDate(businessId, date);
    if (!isOpen) {
      return [];
    }

    // Get all available time slots for the date
    const slots = await getAvailableTimeSlots(
      businessId,
      date,
      serviceDurationMinutes,
      staffId
    );

    return slots;
  } catch (error) {
    console.error('Error getting booking time slots:', error);
    return [];
  }
}

/**
 * Check if a specific date/time is available for booking
 * 
 * @param businessId - Business owner ID
 * @param date - Date to check (YYYY-MM-DD format)
 * @param time - Time to check (HH:MM format)
 * @param staffId - Staff ID (optional, for staff-specific availability)
 * @returns true if the time slot is available
 */
export async function isTimeSlotAvailable(
  businessId: number,
  date: string,
  time: string,
  durationMinutes: number = 60,
  staffId?: string
): Promise<boolean> {
  try {
    // Check business-level availability
    const availability = await isDateTimeAvailable(
      businessId,
      date,
      time,
      durationMinutes,
      staffId
    );
    return availability.isOpen;
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    return false;
  }
}

/**
 * Get business hours for a specific date
 * Used to display business hours in booking UI
 * 
 * @param businessId - Business owner ID
 * @param date - Date to check (YYYY-MM-DD format)
 * @returns Object with startTime and endTime (HH:MM format), or null if closed
 */
export async function getBookingHours(
  businessId: number,
  date: string
): Promise<TimeSlot | null> {
  try {
    const hours = await getBusinessHoursForDate(businessId, date);
    return hours;
  } catch (error) {
    console.error('Error getting booking hours:', error);
    return null;
  }
}

/**
 * Validate booking request before creating appointment
 * 
 * @param businessId - Business owner ID
 * @param date - Booking date (YYYY-MM-DD format)
 * @param time - Booking time (HH:MM format)
 * @param staffId - Staff ID (optional)
 * @returns Object with validation result and error message if invalid
 */
export async function validateBookingRequest(
  businessId: number,
  date: string,
  time: string,
  durationMinutes: number = 60,
  staffId?: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return { valid: false, error: 'Invalid time format. Use HH:MM.' };
    }

    // Check if date is in the past
    const bookingDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    if (bookingDateTime < now) {
      return { valid: false, error: 'Cannot book in the past.' };
    }

    // Check if time slot is available
    const isAvailable = await isTimeSlotAvailable(
      businessId,
      date,
      time,
      durationMinutes,
      staffId
    );
    if (!isAvailable) {
      return { valid: false, error: 'This time slot is not available.' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating booking request:', error);
    return { valid: false, error: 'An error occurred while validating your booking.' };
  }
}

/**
 * Get next available time slot after a given date/time
 * Used for "Find next available" feature
 * 
 * @param businessId - Business owner ID
 * @param afterDate - Start searching from this date (YYYY-MM-DD format)
 * @param afterTime - Start searching from this time (HH:MM format)
 * @param maxDaysToSearch - Maximum days to search ahead (default: 30)
 * @returns Object with date and time of next available slot, or null if none found
 */
export async function getNextAvailableSlot(
  businessId: number,
  afterDate: string,
  afterTime: string,
  durationMinutes: number = 60,
  maxDaysToSearch: number = 30
): Promise<{ date: string; time: string } | null> {
  try {
    const startDate = new Date(afterDate);
    
    for (let i = 0; i < maxDaysToSearch; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];

      // Get available slots for this date
      const slots = await getBookingTimeSlots(businessId, dateStr, durationMinutes);
      
      if (slots.length > 0) {
        // If it's the same day as afterDate, filter for times after afterTime
        if (dateStr === afterDate) {
          const validSlots = slots.filter(slot => slot.startTime > afterTime);
          if (validSlots.length > 0) {
            return { date: dateStr, time: validSlots[0].startTime };
          }
        } else {
          // Different day, return first available slot
          return { date: dateStr, time: slots[0].startTime };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting next available slot:', error);
    return null;
  }
}

/**
 * Get available dates for the next N days
 * Used to populate date picker in booking UI
 * 
 * @param businessId - Business owner ID
 * @param daysAhead - Number of days to check ahead (default: 30)
 * @returns Array of dates (YYYY-MM-DD format) that have available time slots
 */
export async function getAvailableDates(
  businessId: number,
  durationMinutes: number = 60,
  daysAhead: number = 30
): Promise<string[]> {
  try {
    const availableDates: string[] = [];
    const today = new Date();

    for (let i = 0; i < daysAhead; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];

      // Check if this date has available slots
      const slots = await getBookingTimeSlots(businessId, dateStr, durationMinutes);
      if (slots.length > 0) {
        availableDates.push(dateStr);
      }
    }

    return availableDates;
  } catch (error) {
    console.error('Error getting available dates:', error);
    return [];
  }
}
