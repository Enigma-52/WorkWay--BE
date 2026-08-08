import PostgresDao from './dao.js';

class PlansDao extends PostgresDao {
  constructor() {
    super('plans');
  }

  async getAllActive() {
    return this.getQ({
      sql: `SELECT key, name, description, dodo_product_id FROM plans WHERE is_active = true ORDER BY key`,
    });
  }

  async getByKey(key) {
    return this.getQ({
      sql: `SELECT * FROM plans WHERE key = $1 AND is_active = true`,
      values: [key],
      firstResultOnly: true,
    });
  }

  async getByDodoProductId(productId) {
    return this.getQ({
      sql: `SELECT * FROM plans WHERE dodo_product_id = $1 AND is_active = true`,
      values: [productId],
      firstResultOnly: true,
    });
  }

  async exists(key) {
    const row = await this.getQ({
      sql: `SELECT key FROM plans WHERE key = $1 AND is_active = true`,
      values: [key],
      firstResultOnly: true,
    });
    return !!row;
  }

  async setDodoProductId(key, dodoProductId) {
    return this.getQ({
      sql: `UPDATE plans SET dodo_product_id = $1 WHERE key = $2 RETURNING *`,
      values: [dodoProductId, key],
      firstResultOnly: true,
    });
  }
}

export const plansDao = new PlansDao();
