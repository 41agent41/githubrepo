-- TradingApp Database Verification Script
-- Run this script to verify database setup and troubleshoot connectivity issues
-- Execute in your PostgreSQL database interface

-- ==============================================
-- BASIC CONNECTIVITY VERIFICATION
-- ==============================================

-- Check database version and extensions
SELECT 
    'Database Info' as check_type,
    version() as postgresql_version,
    current_database() as database_name,
    current_user as current_user,
    NOW() as current_timestamp;

-- Check TimescaleDB extension
SELECT 
    'TimescaleDB Extension' as check_type,
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') 
         THEN 'ENABLED' ELSE 'NOT AVAILABLE' END as status;

-- ==============================================
-- TABLE VERIFICATION
-- ==============================================

-- Check all required tables exist
SELECT 
    'Table Verification' as check_type,
    COUNT(*) as total_tables,
    CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as status,
    STRING_AGG(table_name, ', ' ORDER BY table_name) as tables_found
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');

-- List all tables with their types
SELECT 
    'All Tables' as check_type,
    table_name,
    table_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables h 
        WHERE h.hypertable_name = t.table_name
    ) THEN 'HYPERTABLE' ELSE 'REGULAR' END as table_category
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
ORDER BY table_name;

-- ==============================================
-- PRIMARY KEY VERIFICATION
-- ==============================================

-- Check primary keys (detailed)
SELECT 
    'Primary Key Details' as check_type,
    tc.table_name,
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as primary_key_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Primary key count verification
SELECT 
    'Primary Key Count' as check_type,
    COUNT(*) as primary_key_count,
    CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as status,
    'Expected: 6' as expected
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'PRIMARY KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');

-- ==============================================
-- CONSTRAINT VERIFICATION (CONNECTIVITY TEST LOGIC)
-- ==============================================

-- Exact same query as backend connectivity test
SELECT 
    'Backend Connectivity Logic' as check_type,
    COUNT(*) FILTER (WHERE constraint_type = 'PRIMARY KEY') as primary_keys,
    COUNT(*) FILTER (WHERE constraint_type = 'UNIQUE') as unique_constraints,
    COUNT(*) FILTER (WHERE constraint_type = 'FOREIGN KEY') as foreign_keys,
    COUNT(*) as total_constraints,
    -- Backend validation logic
    CASE WHEN COUNT(*) FILTER (WHERE constraint_type = 'PRIMARY KEY') >= 6 
              AND COUNT(*) FILTER (WHERE constraint_type = 'UNIQUE') >= 4 
              AND COUNT(*) FILTER (WHERE constraint_type = 'FOREIGN KEY') >= 2 
         THEN 'PASS - Should show SUCCESS' 
         ELSE 'FAIL - Will show WARNING' END as backend_validation_result
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
AND tc.table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');

-- Detailed constraint breakdown
SELECT 
    'Constraint Breakdown' as check_type,
    tc.constraint_type,
    COUNT(*) as count,
    STRING_AGG(tc.table_name, ', ' ORDER BY tc.table_name) as tables
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
AND tc.table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
GROUP BY tc.constraint_type
ORDER BY tc.constraint_type;

-- ==============================================
-- INDEX VERIFICATION
-- ==============================================

-- Check expected indexes exist
SELECT 
    'Index Verification' as check_type,
    COUNT(*) as total_indexes,
    COUNT(*) FILTER (WHERE indexname IN (
        'idx_contracts_symbol', 'idx_contracts_sec_type', 'idx_contracts_exchange', 'idx_contracts_contract_id',
        'idx_candlestick_contract_timeframe', 'idx_candlestick_timestamp', 'idx_candlestick_contract_timestamp',
        'idx_candlestick_contract_timetrans', 'idx_candlestick_drawtimestamp',
        'idx_tick_contract_timestamp', 'idx_tick_type',
        'idx_sessions_contract', 'idx_sessions_status',
        'idx_quality_contract_date'
    )) as expected_indexes,
    CASE WHEN COUNT(*) FILTER (WHERE indexname IN (
        'idx_contracts_symbol', 'idx_contracts_sec_type', 'idx_contracts_exchange', 'idx_contracts_contract_id',
        'idx_candlestick_contract_timeframe', 'idx_candlestick_timestamp', 'idx_candlestick_contract_timestamp',
        'idx_candlestick_contract_timetrans', 'idx_candlestick_drawtimestamp',
        'idx_tick_contract_timestamp', 'idx_tick_type',
        'idx_sessions_contract', 'idx_sessions_status',
        'idx_quality_contract_date'
    )) >= 13 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');

-- List all indexes
SELECT 
    'Index Details' as check_type,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
ORDER BY tablename, indexname;

-- ==============================================
-- DATA VERIFICATION
-- ==============================================

-- Check data counts
SELECT 
    'Data Counts' as check_type,
    (SELECT COUNT(*) FROM contracts) as contract_count,
    (SELECT COUNT(*) FROM candlestick_data) as candlestick_count,
    (SELECT COUNT(*) FROM tick_data) as tick_count,
    (SELECT COUNT(*) FROM data_collection_sessions) as session_count,
    (SELECT COUNT(*) FROM data_quality_metrics) as quality_count,
    (SELECT COUNT(*) FROM data_collection_config) as config_count;

-- Check sample contracts
SELECT 
    'Sample Contracts' as check_type,
    symbol,
    sec_type,
    exchange,
    currency
FROM contracts 
ORDER BY symbol 
LIMIT 5;

-- ==============================================
-- TIMESCALEDB VERIFICATION
-- ==============================================

-- Check hypertables (if TimescaleDB is enabled)
SELECT 
    'TimescaleDB Hypertables' as check_type,
    hypertable_name,
    num_chunks,
    compression_enabled,
    replication_factor
FROM timescaledb_information.hypertables
WHERE hypertable_name IN ('candlestick_data', 'tick_data')
ORDER BY hypertable_name;

-- ==============================================
-- FINAL SUMMARY
-- ==============================================

-- Overall verification summary
DO $$
DECLARE
    table_count INTEGER;
    pk_count INTEGER;
    uk_count INTEGER;
    fk_count INTEGER;
    idx_count INTEGER;
    overall_status TEXT;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');
    
    SELECT COUNT(*) INTO pk_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public'
    AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');
    
    SELECT COUNT(*) INTO uk_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'UNIQUE' AND table_schema = 'public'
    AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');
    
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
    AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');
    
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname IN (
        'idx_contracts_symbol', 'idx_contracts_sec_type', 'idx_contracts_exchange', 'idx_contracts_contract_id',
        'idx_candlestick_contract_timeframe', 'idx_candlestick_timestamp', 'idx_candlestick_contract_timestamp',
        'idx_candlestick_contract_timetrans', 'idx_candlestick_drawtimestamp',
        'idx_tick_contract_timestamp', 'idx_tick_type',
        'idx_sessions_contract', 'idx_sessions_status',
        'idx_quality_contract_date'
    );
    
    -- Determine overall status
    IF table_count >= 6 AND pk_count >= 6 AND uk_count >= 4 AND fk_count >= 2 AND idx_count >= 13 THEN
        overall_status := '✅ ALL CHECKS PASS - Database connectivity test should show all green!';
    ELSE
        overall_status := '⚠️ Some checks failed - Database connectivity test will show warnings';
    END IF;
    
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'DATABASE VERIFICATION SUMMARY';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Tables: %/6 (Required: 6)', table_count;
    RAISE NOTICE 'Primary Keys: %/6 (Required: 6)', pk_count;
    RAISE NOTICE 'Unique Constraints: %/4 (Required: 4+)', uk_count;
    RAISE NOTICE 'Foreign Keys: %/2 (Required: 2+)', fk_count;
    RAISE NOTICE 'Indexes: %/13 (Required: 13+)', idx_count;
    RAISE NOTICE '';
    RAISE NOTICE '%', overall_status;
    RAISE NOTICE '';
    RAISE NOTICE 'If checks pass but connectivity test still fails:';
    RAISE NOTICE '1. Restart the backend service';
    RAISE NOTICE '2. Clear browser cache';
    RAISE NOTICE '3. Check backend logs for constraint validation details';
END $$;
