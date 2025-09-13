-- Migration script to remove WAP and count columns from candlestick_data table
-- This script safely removes the wap and count columns that are no longer needed

-- Step 1: Backup existing data (optional - for safety)
-- CREATE TABLE candlestick_data_backup AS SELECT * FROM candlestick_data;

-- Step 2: Drop the columns
-- Note: PostgreSQL will automatically handle dependent objects like indexes
ALTER TABLE candlestick_data DROP COLUMN IF EXISTS wap;
ALTER TABLE candlestick_data DROP COLUMN IF EXISTS count;

-- Step 3: Verify the changes
-- Check that the columns have been removed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'candlestick_data' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Verify data integrity
-- Ensure the table still has the essential OHLCV data
SELECT COUNT(*) as total_records FROM candlestick_data;
SELECT 
    COUNT(*) as records_with_complete_data,
    COUNT(*) FILTER (WHERE open IS NOT NULL AND high IS NOT NULL AND low IS NOT NULL AND close IS NOT NULL AND volume IS NOT NULL) as complete_ohlcv_records
FROM candlestick_data;

-- Migration completed successfully
-- The candlestick_data table now only contains essential OHLCV data without WAP and count columns
