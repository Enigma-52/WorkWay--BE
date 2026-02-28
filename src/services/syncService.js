import { defaultPgDao , runPgStatement } from "../dao/dao.js";
import fs from "fs";
import { SKILLS , SKILL_TYPE_UI_NAMES , slugify} from '../data/skills.js'

export async function syncSkills(){
    const rows = SKILLS.map(skill => {
        const groupName = SKILL_TYPE_UI_NAMES[skill.type] ?? skill.type;
      
        const esc = (s) => s.replace(/'/g, "''");
      
        return `(
      '${esc(skill.name)}',
      '${slugify(skill.name)}',
      '${esc(skill.type)}',
      '${esc(groupName)}',
      '${slugify(groupName)}'
      )`;
      });
      
      const sql = `
      INSERT INTO skills
      (name, slug, skill_group_type, skill_group_name, skill_group_slug)
      VALUES
      ${rows.join(",\n")};
      `;
            
      fs.writeFileSync("skills_seed.sql", sql.trim());
      console.log("skills_seed.sql generated");
}