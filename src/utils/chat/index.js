import {
    filterJobsStructured,
    rankJobsWithinCandidates,
    getAllDomains,
    getAllExperienceLevels
  } from './tools.js';
  
  export const TOOL_REGISTRY = [
    {
      name: "filter_jobs_structured",
      schema: {
        description: "Filter jobs using structured constraints like location, company, experience_level, company domain",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
            company: { type: "string" },
            experience_level: { type: "string" },
            domain: { type: "string" }
          }
        }
      },
      handler: async (filters) => filterJobsStructured(filters)
    },
    {
      name: "rank_jobs_within_candidates",
      schema: {
        description: "Rank candidate jobs by semantic similarity to query",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            candidate_ids: {
              type: "array",
              items: { type: "number" }
            },
          },
          required: ["query", "candidate_ids"]
        }
      },
      handler: async ({ query, candidate_ids }) =>
        rankJobsWithinCandidates(query, candidate_ids)
    },
    {
        name: "get_all_domains",
        schema: {
          description: "Get all unique job domains available in the database for better queries",
          parameters: {
            type: "object",
            properties: {}
          }
        },
        handler: async () => getAllDomains()
      },
    
      {
        name: "get_all_experience_levels",
        schema: {
          description: "Get all unique experience levels available in the database for better queries",
          parameters: {
            type: "object",
            properties: {}
          }
        },
        handler: async () => getAllExperienceLevels()
      }
  ]