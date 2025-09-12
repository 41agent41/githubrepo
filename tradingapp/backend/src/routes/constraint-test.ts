import express from 'express';
import type { Request, Response } from 'express';
import { dbService } from '../services/database.js';

const router = express.Router();

// Test constraint validation endpoint
router.get('/test-constraints', async (req: Request, res: Response) => {
  try {
    // Get constraint counts (same logic as connectivity test)
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
    
    // Validation logic (same as connectivity test)
    const expectedPrimaryKeys = 6;
    const expectedUniqueConstraints = 4;
    const expectedForeignKeys = 2;
    
    const constraintsExist = primaryKeys >= expectedPrimaryKeys && uniqueConstraints >= expectedUniqueConstraints && foreignKeys >= expectedForeignKeys;
    
    const status = constraintsExist ? 'success' : 'warning';
    const message = constraintsExist 
      ? `All constraints properly configured: ${primaryKeys} primary keys, ${uniqueConstraints} unique constraints, ${foreignKeys} foreign keys`
      : `Constraint issues found: ${primaryKeys}/${expectedPrimaryKeys} primary keys, ${uniqueConstraints}/${expectedUniqueConstraints} unique constraints, ${foreignKeys}/${expectedForeignKeys} foreign keys`;

    res.json({
      status,
      message,
      counts: {
        primaryKeys,
        uniqueConstraints,
        foreignKeys,
        total: foundConstraints.length
      },
      expected: {
        primaryKeys: expectedPrimaryKeys,
        uniqueConstraints: expectedUniqueConstraints,
        foreignKeys: expectedForeignKeys
      },
      validation: {
        primaryKeysPass: primaryKeys >= expectedPrimaryKeys,
        uniqueConstraintsPass: uniqueConstraints >= expectedUniqueConstraints,
        foreignKeysPass: foreignKeys >= expectedForeignKeys,
        overallPass: constraintsExist
      },
      allConstraints: foundConstraints
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Constraint test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
