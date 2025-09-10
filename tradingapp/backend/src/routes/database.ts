import express from 'express';
import type { Request, Response } from 'express';
import { dbService } from '../services/database.js';

const router = express.Router();

// Comprehensive database connectivity test endpoint
router.post('/connectivity-test', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const tests: Array<{
    test: string;
    status: 'success' | 'error' | 'warning';
    message: string;
    details?: any;
    duration?: number;
  }> = [];

  let connectionPool = {
    total: 0,
    idle: 0,
    waiting: 0,
    active: 0
  };

  let performance = {
    avgQueryTime: 0,
    slowestQuery: 0,
    totalQueries: 0
  };

  let schema = {
    tablesExist: false,
    indexesExist: false,
    constraintsExist: false
  };

  try {
    // Test 1: Basic Connection Test
    const connectionStart = Date.now();
    try {
      const connected = await dbService.testConnection();
      const connectionDuration = Date.now() - connectionStart;
      
      tests.push({
        test: 'Basic Connection',
        status: connected ? 'success' : 'error',
        message: connected ? 'Database connection successful' : 'Database connection failed',
        duration: connectionDuration
      });
    } catch (error) {
      tests.push({
        test: 'Basic Connection',
        status: 'error',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - connectionStart
      });
    }

    // Test 2: Connection Pool Status
    const poolStart = Date.now();
    try {
      const poolQuery = `
        SELECT 
          count(*) as total,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE wait_event_type = 'Lock') as waiting
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      const poolResult = await dbService.query(poolQuery);
      if (poolResult.rows.length > 0) {
        const row = poolResult.rows[0];
        connectionPool = {
          total: parseInt(row.total) || 0,
          idle: parseInt(row.idle) || 0,
          active: parseInt(row.active) || 0,
          waiting: parseInt(row.waiting) || 0
        };
      }

      tests.push({
        test: 'Connection Pool Status',
        status: 'success',
        message: `Pool: ${connectionPool.total} total, ${connectionPool.idle} idle, ${connectionPool.active} active`,
        details: connectionPool,
        duration: Date.now() - poolStart
      });
    } catch (error) {
      tests.push({
        test: 'Connection Pool Status',
        status: 'warning',
        message: `Could not retrieve pool status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - poolStart
      });
    }

    // Test 3: Database Version and Info
    const versionStart = Date.now();
    try {
      const versionResult = await dbService.query('SELECT version(), current_database(), current_user');
      const versionInfo = versionResult.rows[0];
      
      tests.push({
        test: 'Database Version',
        status: 'success',
        message: `PostgreSQL ${versionInfo.version.split(' ')[1]} - Database: ${versionInfo.current_database}`,
        details: {
          version: versionInfo.version,
          database: versionInfo.current_database,
          user: versionInfo.current_user
        },
        duration: Date.now() - versionStart
      });
    } catch (error) {
      tests.push({
        test: 'Database Version',
        status: 'error',
        message: `Could not retrieve version info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - versionStart
      });
    }

    // Test 4: Schema Validation - Tables
    const schemaStart = Date.now();
    try {
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
        ORDER BY table_name
      `;
      
      const tablesResult = await dbService.query(tablesQuery);
      const expectedTables = ['contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config'];
      const foundTables = tablesResult.rows.map(row => row.table_name);
      const missingTables = expectedTables.filter(table => !foundTables.includes(table));
      
      schema.tablesExist = missingTables.length === 0;
      
      tests.push({
        test: 'Schema Tables',
        status: missingTables.length === 0 ? 'success' : 'warning',
        message: missingTables.length === 0 
          ? `All ${expectedTables.length} required tables exist`
          : `Missing tables: ${missingTables.join(', ')}`,
        details: {
          expected: expectedTables,
          found: foundTables,
          missing: missingTables
        },
        duration: Date.now() - schemaStart
      });
    } catch (error) {
      tests.push({
        test: 'Schema Tables',
        status: 'error',
        message: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - schemaStart
      });
    }

    // Test 5: Schema Validation - Indexes
    const indexesStart = Date.now();
    try {
      const indexesQuery = `
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
        ORDER BY tablename, indexname
      `;
      
      const indexesResult = await dbService.query(indexesQuery);
      const expectedIndexes = [
        'idx_contracts_symbol', 'idx_contracts_sec_type', 'idx_contracts_exchange', 'idx_contracts_contract_id',
        'idx_candlestick_contract_timeframe', 'idx_candlestick_timestamp', 'idx_candlestick_contract_timestamp',
        'idx_tick_contract_timestamp', 'idx_tick_type',
        'idx_sessions_contract', 'idx_sessions_status',
        'idx_quality_contract_date'
      ];
      const foundIndexes = indexesResult.rows.map(row => row.indexname);
      const missingIndexes = expectedIndexes.filter(index => !foundIndexes.includes(index));
      
      schema.indexesExist = missingIndexes.length === 0;
      
      tests.push({
        test: 'Schema Indexes',
        status: missingIndexes.length === 0 ? 'success' : 'warning',
        message: missingIndexes.length === 0 
          ? `All ${expectedIndexes.length} required indexes exist`
          : `Missing indexes: ${missingIndexes.join(', ')}`,
        details: {
          expected: expectedIndexes,
          found: foundIndexes,
          missing: missingIndexes
        },
        duration: Date.now() - indexesStart
      });
    } catch (error) {
      tests.push({
        test: 'Schema Indexes',
        status: 'error',
        message: `Index validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - indexesStart
      });
    }

    // Test 6: Schema Validation - Constraints
    const constraintsStart = Date.now();
    try {
      const constraintsQuery = `
        SELECT 
          tc.constraint_name,
          tc.table_name,
          tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        AND tc.table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
        ORDER BY tc.table_name, tc.constraint_name
      `;
      
      const constraintsResult = await dbService.query(constraintsQuery);
      const foundConstraints = constraintsResult.rows;
      const primaryKeys = foundConstraints.filter(c => c.constraint_type === 'PRIMARY KEY').length;
      const uniqueConstraints = foundConstraints.filter(c => c.constraint_type === 'UNIQUE').length;
      const foreignKeys = foundConstraints.filter(c => c.constraint_type === 'FOREIGN KEY').length;
      
      schema.constraintsExist = primaryKeys >= 6 && uniqueConstraints >= 6 && foreignKeys >= 4; // Expected minimum counts
      
      tests.push({
        test: 'Schema Constraints',
        status: schema.constraintsExist ? 'success' : 'warning',
        message: `Found ${primaryKeys} primary keys, ${uniqueConstraints} unique constraints, ${foreignKeys} foreign keys`,
        details: {
          primaryKeys,
          uniqueConstraints,
          foreignKeys,
          allConstraints: foundConstraints
        },
        duration: Date.now() - constraintsStart
      });
    } catch (error) {
      tests.push({
        test: 'Schema Constraints',
        status: 'error',
        message: `Constraint validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - constraintsStart
      });
    }

    // Test 7: Performance Test - Simple Query
    const perfStart = Date.now();
    try {
      const perfQuery = 'SELECT COUNT(*) as count FROM contracts';
      const perfResult = await dbService.query(perfQuery);
      const perfDuration = Date.now() - perfStart;
      
      performance.avgQueryTime = perfDuration;
      performance.slowestQuery = perfDuration;
      performance.totalQueries = 1;
      
      tests.push({
        test: 'Performance Test',
        status: perfDuration < 100 ? 'success' : perfDuration < 500 ? 'warning' : 'error',
        message: `Simple query completed in ${perfDuration}ms (${perfResult.rows[0].count} contracts)`,
        details: {
          queryTime: perfDuration,
          resultCount: perfResult.rows[0].count
        },
        duration: perfDuration
      });
    } catch (error) {
      tests.push({
        test: 'Performance Test',
        status: 'error',
        message: `Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - perfStart
      });
    }

    // Test 8: Data Integrity Test
    const integrityStart = Date.now();
    try {
      const integrityQuery = `
        SELECT 
          (SELECT COUNT(*) FROM contracts) as contract_count,
          (SELECT COUNT(*) FROM candlestick_data) as candlestick_count,
          (SELECT COUNT(*) FROM tick_data) as tick_count,
          (SELECT COUNT(*) FROM data_collection_sessions) as session_count
      `;
      
      const integrityResult = await dbService.query(integrityQuery);
      const data = integrityResult.rows[0];
      
      tests.push({
        test: 'Data Integrity',
        status: 'success',
        message: `Data counts: ${data.contract_count} contracts, ${data.candlestick_count} candlesticks, ${data.tick_count} ticks, ${data.session_count} sessions`,
        details: {
          contracts: parseInt(data.contract_count),
          candlesticks: parseInt(data.candlestick_count),
          ticks: parseInt(data.tick_count),
          sessions: parseInt(data.session_count)
        },
        duration: Date.now() - integrityStart
      });
    } catch (error) {
      tests.push({
        test: 'Data Integrity',
        status: 'warning',
        message: `Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - integrityStart
      });
    }

    // Test 9: Transaction Test
    const transactionStart = Date.now();
    try {
      await dbService.transaction(async (client) => {
        await client.query('SELECT 1');
        await client.query('SELECT NOW()');
      });
      
      tests.push({
        test: 'Transaction Test',
        status: 'success',
        message: 'Transaction test completed successfully',
        duration: Date.now() - transactionStart
      });
    } catch (error) {
      tests.push({
        test: 'Transaction Test',
        status: 'error',
        message: `Transaction test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - transactionStart
      });
    }

    // Determine overall status
    const hasErrors = tests.some(test => test.status === 'error');
    const hasWarnings = tests.some(test => test.status === 'warning');
    const overallStatus = hasErrors ? 'unhealthy' : hasWarnings ? 'warning' : 'healthy';

    const totalDuration = Date.now() - startTime;

    res.json({
      overall: overallStatus,
      tests,
      connectionPool,
      performance,
      schema,
      lastChecked: new Date().toISOString(),
      totalTestDuration: totalDuration
    });

  } catch (error) {
    console.error('Error in database connectivity test:', error);
    
    res.status(500).json({
      overall: 'unhealthy',
      tests: [{
        test: 'Connectivity Test',
        status: 'error',
        message: `Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      }],
      connectionPool,
      performance,
      schema,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simple database health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const connected = await dbService.testConnection();
    
    if (connected) {
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Database statistics endpoint
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await dbService.query(`
      SELECT 
        (SELECT COUNT(*) FROM contracts) as contract_count,
        (SELECT COUNT(*) FROM candlestick_data) as candlestick_count,
        (SELECT COUNT(*) FROM tick_data) as tick_count,
        (SELECT COUNT(*) FROM data_collection_sessions) as session_count,
        (SELECT COUNT(*) FROM data_quality_metrics) as quality_count,
        (SELECT COUNT(*) FROM data_collection_config) as config_count
    `);
    
    res.json({
      stats: stats.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
