-- Migration: Unified Availability Management System
-- Date: 2026-04-11
-- Description: Add new tables and columns for unified availability management
-- Backward Compatible: YES - Old tables and columns remain unchanged

-- ============================================================================
-- Phase 1: Create New Tables
-- ============================================================================

-- Table: dailyOverrides
-- Purpose: Store daily schedule overrides (e.g., "closed on 2026-04-15" or "custom hours 10-16")
-- Backward Compatible: YES - New table, doesn't affect existing data
CREATE TABLE IF NOT EXISTS dailyOverrides (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  isWorkDay BOOLEAN DEFAULT true,
  startTime TEXT,
  endTime TEXT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(businessOwnerId, date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dailyOverrides_businessOwnerId 
ON dailyOverrides(businessOwnerId);

CREATE INDEX IF NOT EXISTS idx_dailyOverrides_businessOwnerId_date 
ON dailyOverrides(businessOwnerId, date);

CREATE INDEX IF NOT EXISTS idx_dailyOverrides_date 
ON dailyOverrides(date);

-- Table: staffAvailability
-- Purpose: Store staff-specific availability for specific dates
-- Backward Compatible: YES - New table, doesn't affect existing data
CREATE TABLE IF NOT EXISTS staffAvailability (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id) ON DELETE CASCADE,
  staffId TEXT NOT NULL REFERENCES staffMembers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  isAvailable BOOLEAN DEFAULT true,
  startTime TEXT,
  endTime TEXT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staffId, date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_staffAvailability_staffId 
ON staffAvailability(staffId);

CREATE INDEX IF NOT EXISTS idx_staffAvailability_staffId_date 
ON staffAvailability(staffId, date);

CREATE INDEX IF NOT EXISTS idx_staffAvailability_businessOwnerId 
ON staffAvailability(businessOwnerId);

CREATE INDEX IF NOT EXISTS idx_staffAvailability_date 
ON staffAvailability(date);

-- ============================================================================
-- Phase 2: Add New Columns to Existing Tables
-- ============================================================================

-- Add multiStaffMode to businessOwners
-- Purpose: Flag indicating if business uses multiple staff members
-- Backward Compatible: YES - Column has default value (false)
ALTER TABLE businessOwners 
ADD COLUMN IF NOT EXISTS multiStaffMode BOOLEAN DEFAULT false;

-- Add staffId to appointments
-- Purpose: Track which staff member is assigned to appointment
-- Backward Compatible: YES - Column is nullable (NULL = unassigned)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS staffId TEXT REFERENCES staffMembers(id) ON DELETE SET NULL;

-- Add locationId to appointments
-- Purpose: Track which location appointment is at
-- Backward Compatible: YES - Column is nullable (NULL = default location)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS locationId TEXT REFERENCES locations(id) ON DELETE SET NULL;

-- Create index for appointments by staffId
CREATE INDEX IF NOT EXISTS idx_appointments_staffId 
ON appointments(staffId);

-- Create index for appointments by locationId
CREATE INDEX IF NOT EXISTS idx_appointments_locationId 
ON appointments(locationId);

-- ============================================================================
-- Phase 3: Populate multiStaffMode Based on Existing Data
-- ============================================================================

-- Set multiStaffMode = true for businesses with multiple staff
UPDATE businessOwners
SET multiStaffMode = true
WHERE id IN (
  SELECT businessOwnerId
  FROM staffMembers
  GROUP BY businessOwnerId
  HAVING COUNT(*) > 1
);

-- ============================================================================
-- Phase 4: Create Views for Backward Compatibility
-- ============================================================================

-- View: businessHoursView
-- Purpose: Unified view of business hours from workingHours table
-- Backward Compatible: YES - Can be used instead of direct table access
CREATE OR REPLACE VIEW businessHoursView AS
SELECT 
  id,
  businessOwnerId,
  dayOfWeek,
  startTime,
  endTime,
  isEnabled,
  createdAt,
  updatedAt
FROM workingHours;

-- ============================================================================
-- Phase 5: Create Helper Functions
-- ============================================================================

-- Function: is_business_open_on_date
-- Purpose: Check if business is open on a specific date
-- Backward Compatible: YES - New function, doesn't affect existing code
CREATE OR REPLACE FUNCTION is_business_open_on_date(
  p_business_id TEXT,
  p_date TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week TEXT;
  v_is_enabled BOOLEAN;
  v_override_exists BOOLEAN;
  v_override_is_work_day BOOLEAN;
BEGIN
  -- Check if there's a daily override for this date
  SELECT EXISTS(SELECT 1 FROM dailyOverrides WHERE businessOwnerId = p_business_id AND date = p_date)
  INTO v_override_exists;
  
  IF v_override_exists THEN
    SELECT isWorkDay INTO v_override_is_work_day 
    FROM dailyOverrides 
    WHERE businessOwnerId = p_business_id AND date = p_date;
    RETURN v_override_is_work_day;
  END IF;
  
  -- Fall back to regular working hours
  v_day_of_week := TO_CHAR(TO_DATE(p_date, 'YYYY-MM-DD'), 'Day');
  
  SELECT isEnabled INTO v_is_enabled
  FROM workingHours
  WHERE businessOwnerId = p_business_id AND dayOfWeek = TRIM(v_day_of_week);
  
  RETURN COALESCE(v_is_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- Function: get_business_hours_for_date
-- Purpose: Get business hours for a specific date
-- Backward Compatible: YES - New function, doesn't affect existing code
CREATE OR REPLACE FUNCTION get_business_hours_for_date(
  p_business_id TEXT,
  p_date TEXT
) RETURNS TABLE(start_time TEXT, end_time TEXT) AS $$
DECLARE
  v_day_of_week TEXT;
BEGIN
  -- Check if there's a daily override for this date
  RETURN QUERY
  SELECT dailyOverrides.startTime, dailyOverrides.endTime
  FROM dailyOverrides
  WHERE businessOwnerId = p_business_id AND date = p_date AND isWorkDay = true;
  
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- Fall back to regular working hours
  v_day_of_week := TO_CHAR(TO_DATE(p_date, 'YYYY-MM-DD'), 'Day');
  
  RETURN QUERY
  SELECT workingHours.startTime, workingHours.endTime
  FROM workingHours
  WHERE businessOwnerId = p_business_id 
    AND dayOfWeek = TRIM(v_day_of_week)
    AND isEnabled = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Phase 6: Rollback Instructions
-- ============================================================================

-- To rollback this migration, run:
-- DROP TABLE IF EXISTS staffAvailability CASCADE;
-- DROP TABLE IF EXISTS dailyOverrides CASCADE;
-- DROP VIEW IF EXISTS businessHoursView;
-- DROP FUNCTION IF EXISTS is_business_open_on_date(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS get_business_hours_for_date(TEXT, TEXT);
-- ALTER TABLE businessOwners DROP COLUMN IF EXISTS multiStaffMode;
-- ALTER TABLE appointments DROP COLUMN IF EXISTS staffId;
-- ALTER TABLE appointments DROP COLUMN IF EXISTS locationId;
-- DROP INDEX IF EXISTS idx_dailyOverrides_businessOwnerId;
-- DROP INDEX IF EXISTS idx_dailyOverrides_businessOwnerId_date;
-- DROP INDEX IF EXISTS idx_dailyOverrides_date;
-- DROP INDEX IF EXISTS idx_staffAvailability_staffId;
-- DROP INDEX IF EXISTS idx_staffAvailability_staffId_date;
-- DROP INDEX IF EXISTS idx_staffAvailability_businessOwnerId;
-- DROP INDEX IF EXISTS idx_staffAvailability_date;
-- DROP INDEX IF EXISTS idx_appointments_staffId;
-- DROP INDEX IF EXISTS idx_appointments_locationId;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify tables created
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('dailyOverrides', 'staffAvailability');

-- Verify columns added
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'businessOwners' AND column_name = 'multiStaffMode';

-- Verify indexes created
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('dailyOverrides', 'staffAvailability', 'appointments');
