import { getPgPool } from '../utils/initializers/postgres.js';

export async function runPgStatement({ db = getPgPool(), query, values = [] }) {
  const result = await db.query(query, values);
  return result.rows;
}

function debugSQL(sql, values) {
  return sql.replace(/\$(\d+)/g, (_, n) => {
    const v = values[Number(n) - 1];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  });
}

export default class PostgresDao {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async getQ({ db = getPgPool(), sql, values = [], firstResultOnly = false }) {
    console.log(sql, values);
    const result = await db.query(sql, values);
    console.log(result.rows);
    return !firstResultOnly ? result.rows : result.rows.length > 0 ? result.rows[0] : null;
  }

  async updateQ({ db = getPgPool(), sql, values = [] }) {
    return await db.query(sql, values);
  }

  async getRow({ db = getPgPool(), where, orderBy, offset, tableName = this.tableName } = {}) {
    let query = `SELECT * FROM ${tableName}`;
    const values = [];

    if (where && typeof where === 'object' && !Array.isArray(where)) {
      const conditions = Object.entries(where).map(([key, value], index) => {
        values.push(value);
        return `${key} = $${index + 1}`;
      });
      query += ' WHERE ' + conditions.join(' AND ');
    }

    if (orderBy) {
      query += ' ORDER BY ' + orderBy;
    }

    if (offset) {
      query += ` OFFSET ` + offset;
    }

    // LIMIT should always be added last
    query += ` LIMIT $${values.length + 1}`;
    values.push(1);

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  async getAllRows({
    db = getPgPool(),
    where,
    orderBy,
    limit,
    offset,
    tableName = this.tableName,
  } = {}) {
    let query = `SELECT * FROM ${tableName}`;
    const values = [];

    if (where) query += ' WHERE ' + where;
    if (orderBy) query += ' ORDER BY ' + orderBy;
    if (limit) {
      query += ' LIMIT $' + (values.length + 1);
      values.push(limit);
    }

    if (offset !== undefined) {
      query += ' OFFSET $' + (values.length + 1);
      values.push(offset);
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  async getAllRowsForChat({
    db = getPgPool(),
    columns = ['*'],     
    where,
    orderBy,
    limit,
    offset,
    tableName = this.tableName,
  } = {}) {
  
    const selectCols = Array.isArray(columns)
      ? columns.join(', ')
      : columns
  
    let query = `SELECT ${selectCols} FROM ${tableName}`
    const values = []
  
    if (where) query += ' WHERE ' + where
    if (orderBy) query += ' ORDER BY ' + orderBy
  
    if (limit) {
      query += ' LIMIT $' + (values.length + 1)
      values.push(limit)
    }
  
    if (offset !== undefined) {
      query += ' OFFSET $' + (values.length + 1)
      values.push(offset)
    }
  
    const result = await db.query(query, values)
    return result.rows
  }

  async insertOrUpdateMultipleObjs({
    db = getPgPool(),
    columnNames,
    multiRowsColValuesList,
    updateColumnNames,
    conflictColumns,
    tableName = this.tableName,
    returningCol = 'id',
  }) {
    const valueStrings = [];
    const flatValues = [];
    let paramIndex = 1;

    multiRowsColValuesList.forEach((row, index) => {
      if (!Array.isArray(row)) {
        throw new Error(`Row at index ${index} is not an array: ${JSON.stringify(row)}`);
      }

      const rowPlaceholders = row.map(() => `$${paramIndex++}`);
      valueStrings.push(`(${rowPlaceholders.join(', ')})`);
      flatValues.push(...row);
    });

    let sql = `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES ${valueStrings.join(
      ', '
    )}`;
    sql += ` ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET `;

    // Build update clause
    const updateClauses = updateColumnNames.map((col) => `${col} = EXCLUDED.${col}`);

    // Automatically add updated_at = CURRENT_TIMESTAMP if not already in updateColumnNames
    if (!updateColumnNames.includes('updated_at')) {
      updateClauses.push('updated_at = CURRENT_TIMESTAMP');
    }

    sql += updateClauses.join(', ');
    sql += ` RETURNING ${returningCol}`;

    try {
      return await db.query(sql, flatValues);
    } catch (error) {
      // If error is about updated_at column not existing, retry without it
      if (error.message.includes('updated_at') && error.code === '42703') {
        const updateClausesWithoutTimestamp = updateColumnNames.map(
          (col) => `${col} = EXCLUDED.${col}`
        );
        let retrySQL = `INSERT INTO ${tableName} (${columnNames.join(
          ', '
        )}) VALUES ${valueStrings.join(', ')}`;
        retrySQL += ` ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET `;
        retrySQL += updateClausesWithoutTimestamp.join(', ');
        retrySQL += ` RETURNING ${returningCol}`;

        return await db.query(retrySQL, flatValues);
      }
      throw error;
    }
  }
}

export const defaultPgDao = new PostgresDao('default');
