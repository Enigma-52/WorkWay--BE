import PostgresDao from './dao.js';

const CAMEL_TO_SNAKE = {
  userId: 'user_id',
  displayName: 'display_name',
  username: 'username',
  professionalTitle: 'professional_title',
  about: 'about',
  category: 'category',
  experienceLevel: 'experience_level',
  country: 'country',
  city: 'city',
  timezone: 'timezone',
  availabilityStatus: 'availability_status',
  skills: 'skills',
  languages: 'languages',
  portfolioUrl: 'portfolio_url',
  linkedinUrl: 'linkedin_url',
  githubUrl: 'github_url',
  websiteUrl: 'website_url',
  avatarUrl: 'avatar_url',
  resumeUrl: 'resume_url',
  resumeFilename: 'resume_filename',
  hourlyRate: 'hourly_rate',
  currency: 'currency',
  status: 'status',
  featuredOrder: 'featured_order',
};

function toSnake(camelKey) {
  return CAMEL_TO_SNAKE[camelKey] || camelKey;
}

function mapKeysToSnake(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnake(key)] = value;
  }
  return result;
}

class TalentProfilesDao extends PostgresDao {
  constructor() {
    super('talent_profiles');
  }

  async getByUserId(userId) {
    return this.getQ({
      sql: `SELECT * FROM talent_profiles WHERE user_id = $1`,
      values: [userId],
      firstResultOnly: true,
    });
  }

  async getByUsername(username) {
    const profile = await this.getQ({
      sql: `SELECT * FROM talent_profiles WHERE LOWER(username) = LOWER($1) AND status = 'published'`,
      values: [username],
      firstResultOnly: true,
    });

    if (!profile) return null;

    const [experiences, education, certifications] = await Promise.all([
      this.getExperiences(profile.id),
      this.getEducation(profile.id),
      this.getCertifications(profile.id),
    ]);

    return {
      ...profile,
      experiences,
      education,
      certifications,
    };
  }

  async create(data) {
    const snakeData = mapKeysToSnake(data);
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `
      INSERT INTO talent_profiles (${keys.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    return this.getQ({ sql, values, firstResultOnly: true });
  }

  async update(userId, data) {
    const snakeData = mapKeysToSnake(data);
    // Remove user_id from update data if present
    delete snakeData.user_id;

    const keys = Object.keys(snakeData);
    if (keys.length === 0) return this.getByUserId(userId);

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    setClauses.push(`updated_at = NOW()`);
    const values = [...Object.values(snakeData), userId];

    const sql = `
      UPDATE talent_profiles
      SET ${setClauses.join(', ')}
      WHERE user_id = $${values.length}
      RETURNING *
    `;

    return this.getQ({ sql, values, firstResultOnly: true });
  }

  async updateVisibility(userId, status) {
    return this.getQ({
      sql: `
        UPDATE talent_profiles
        SET status = $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
      `,
      values: [status, userId],
      firstResultOnly: true,
    });
  }

  async checkUsername(username, excludeUserId) {
    const sql = `
      SELECT id FROM talent_profiles
      WHERE LOWER(username) = LOWER($1) AND user_id != $2
      LIMIT 1
    `;
    const row = await this.getQ({ sql, values: [username, excludeUserId], firstResultOnly: true });
    return !!row;
  }

  async search(filters = {}) {
    const {
      q,
      category,
      experience_level,
      country,
      availability_status,
      sort = 'newest',
      page = 1,
      limit = 20,
    } = filters;

    const conditions = [`status = 'published'`];
    const values = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(
        `(display_name ILIKE $${paramIndex} OR professional_title ILIKE $${paramIndex} OR about ILIKE $${paramIndex})`
      );
      values.push(`%${q}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (experience_level) {
      conditions.push(`experience_level = $${paramIndex}`);
      values.push(experience_level);
      paramIndex++;
    }

    if (country) {
      conditions.push(`country = $${paramIndex}`);
      values.push(country);
      paramIndex++;
    }

    if (availability_status) {
      conditions.push(`availability_status = $${paramIndex}`);
      values.push(availability_status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM talent_profiles WHERE ${whereClause}`;
    const countResult = await this.getQ({ sql: countSql, values });
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Sort
    let orderBy;
    switch (sort) {
      case 'oldest':
        orderBy = 'created_at ASC';
        break;
      case 'name_asc':
        orderBy = 'display_name ASC';
        break;
      case 'name_desc':
        orderBy = 'display_name DESC';
        break;
      default:
        orderBy = 'created_at DESC';
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const dataSql = `
      SELECT * FROM talent_profiles
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataValues = [...values, limitNum, offset];

    const profiles = await this.getQ({ sql: dataSql, values: dataValues });

    return {
      profiles,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async getCategories() {
    return this.getQ({
      sql: `SELECT DISTINCT category FROM talent_profiles WHERE status = 'published' AND category IS NOT NULL ORDER BY category`,
    });
  }

  // ── Experiences ──

  async addExperience(profileId, data) {
    const snakeData = mapKeysToSnake(data);
    snakeData.profile_id = profileId;
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    return this.getQ({
      sql: `INSERT INTO talent_experiences (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
      firstResultOnly: true,
    });
  }

  async updateExperience(id, profileId, data) {
    const snakeData = mapKeysToSnake(data);
    delete snakeData.id;
    delete snakeData.profile_id;
    const keys = Object.keys(snakeData);
    if (keys.length === 0) return null;

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(snakeData), id, profileId];

    return this.getQ({
      sql: `UPDATE talent_experiences SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} AND profile_id = $${keys.length + 2} RETURNING *`,
      values,
      firstResultOnly: true,
    });
  }

  async deleteExperience(id, profileId) {
    return this.getQ({
      sql: `DELETE FROM talent_experiences WHERE id = $1 AND profile_id = $2 RETURNING id`,
      values: [id, profileId],
      firstResultOnly: true,
    });
  }

  async getExperiences(profileId) {
    return this.getQ({
      sql: `SELECT * FROM talent_experiences WHERE profile_id = $1 ORDER BY sort_order ASC, start_date DESC`,
      values: [profileId],
    });
  }

  // ── Education ──

  async addEducation(profileId, data) {
    const snakeData = mapKeysToSnake(data);
    snakeData.profile_id = profileId;
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    return this.getQ({
      sql: `INSERT INTO talent_education (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
      firstResultOnly: true,
    });
  }

  async updateEducation(id, profileId, data) {
    const snakeData = mapKeysToSnake(data);
    delete snakeData.id;
    delete snakeData.profile_id;
    const keys = Object.keys(snakeData);
    if (keys.length === 0) return null;

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(snakeData), id, profileId];

    return this.getQ({
      sql: `UPDATE talent_education SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} AND profile_id = $${keys.length + 2} RETURNING *`,
      values,
      firstResultOnly: true,
    });
  }

  async deleteEducation(id, profileId) {
    return this.getQ({
      sql: `DELETE FROM talent_education WHERE id = $1 AND profile_id = $2 RETURNING id`,
      values: [id, profileId],
      firstResultOnly: true,
    });
  }

  async getEducation(profileId) {
    return this.getQ({
      sql: `SELECT * FROM talent_education WHERE profile_id = $1 ORDER BY sort_order ASC, start_date DESC`,
      values: [profileId],
    });
  }

  // ── Certifications ──

  async addCertification(profileId, data) {
    const snakeData = mapKeysToSnake(data);
    snakeData.profile_id = profileId;
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    return this.getQ({
      sql: `INSERT INTO talent_certifications (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
      firstResultOnly: true,
    });
  }

  async updateCertification(id, profileId, data) {
    const snakeData = mapKeysToSnake(data);
    delete snakeData.id;
    delete snakeData.profile_id;
    const keys = Object.keys(snakeData);
    if (keys.length === 0) return null;

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = [...Object.values(snakeData), id, profileId];

    return this.getQ({
      sql: `UPDATE talent_certifications SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} AND profile_id = $${keys.length + 2} RETURNING *`,
      values,
      firstResultOnly: true,
    });
  }

  async deleteCertification(id, profileId) {
    return this.getQ({
      sql: `DELETE FROM talent_certifications WHERE id = $1 AND profile_id = $2 RETURNING id`,
      values: [id, profileId],
      firstResultOnly: true,
    });
  }

  async getCertifications(profileId) {
    return this.getQ({
      sql: `SELECT * FROM talent_certifications WHERE profile_id = $1 ORDER BY sort_order ASC, issue_date DESC`,
      values: [profileId],
    });
  }
}

export const talentProfilesDao = new TalentProfilesDao();
