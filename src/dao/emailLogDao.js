import PostgresDao from './dao.js';

class EmailLogDao extends PostgresDao {
  constructor() {
    super('email_log');
  }

  async log({ userId, emailType, isTest = false }) {
    return this.getQ({
      sql: `INSERT INTO email_log (user_id, email_type, is_test) VALUES ($1, $2, $3) RETURNING *`,
      values: [userId, emailType, isTest],
      firstResultOnly: true,
    });
  }
}

export const emailLogDao = new EmailLogDao();
