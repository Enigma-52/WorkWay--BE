import OpenAI from "openai"
import { initSSE, sendEvent, closeSSE } from "../utils/sse.js"
import { TOOL_REGISTRY } from '../utils/chat/index.js'

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL,
    "X-Title": process.env.OPENROUTER_SITE_NAME,
  },
})

// Build tools array for OpenAI from registry
const tools = TOOL_REGISTRY.map(({ name, schema }) => ({
  type: "function",
  function: { name, ...schema }
}))

const toolByName = Object.fromEntries(
  TOOL_REGISTRY.map((t) => [t.name, t])
)


export async function chatStreamHandler(req, res) {
  const { message } = req.body

  initSSE(res)

  const messages = [
    {
    role: "system",
    content: `
    You are an intelligent job search assistant that retrieves real job data using tools.
    
    Your responsibilities:
    - Understand user intent
    - Decide the correct retrieval strategy
    - Call tools to fetch real data
    - Explain what you are doing step by step
    - Never invent job listings or details
    
    --------------------------------
    RETRIEVAL STRATEGY RULES
    --------------------------------
    
    There are three retrieval modes:
    
    1) STRUCTURED FILTERING
    Use when the user specifies explicit constraints such as:
    - location
    - company name
    - company domain (AI, fintech, etc.)
    - seniority or role level
    - skills or technologies
    - salary or employment type

    -- NOTE : use helper tools to get the existing domains/experience levels to know if the value u want exists in db or not, else use some other tools to answer the user query
    
    When constraints exist:
    FIRST call the structured filtering tool to obtain candidate job IDs.
    
    2) SEMANTIC RANKING WITHIN CANDIDATES
    After filtering, rank those candidate jobs by semantic similarity to the user’s intent.
    
    Always perform semantic ranking after structured filtering unless the user only wants raw filtered results.
    
    3) GLOBAL SEMANTIC SEARCH
    Use only when the query is vague, conceptual, exploratory, or has no clear structured constraints.
    Example:
    - interesting startups
    - impactful work
    - cutting edge AI roles
    
    --------------------------------
    MULTI-STEP EXECUTION POLICY
    --------------------------------
    
    When structured constraints exist:
    
    Step 1 — filter jobs using structured criteria  
    Step 2 — rank filtered jobs by semantic similarity  
    Step 3 — present final results  
    
    Always execute in this order.
    
    --------------------------------
    TRANSPARENCY REQUIREMENT
    --------------------------------
    
    You must clearly communicate what you are doing.
    
    Explain:
    - what filters were applied
    - how many candidates were found
    - that ranking was performed
    - why results were selected
    
    Do not hide retrieval steps.
    
    --------------------------------
    TOOL USAGE RULES
    --------------------------------
    
    - Always use tools to retrieve job data.
    - Never fabricate jobs.
    - Never answer from prior knowledge.
    - If tools return zero results, say so clearly.
    - If filters are unclear, ask for clarification.
    
    --------------------------------
    RESULT PRESENTATION
    --------------------------------
    
    When presenting jobs:
    - summarize relevance
    - highlight key match factors
    - be concise and factual
    
    If structured job data is provided separately, do not restate it verbatim.
    
    --------------------------------
    ERROR HANDLING
    --------------------------------
    
    If a tool fails or returns empty results:
    - explain what happened
    - suggest refinement options
    
    --------------------------------
    BEHAVIORAL STYLE
    --------------------------------
    
    Be precise, factual, and transparent.
    Avoid marketing language.
    Do not exaggerate relevance.
    Do not speculate about companies or roles.
    
    --------------------------------
    GOAL
    --------------------------------
    
    Retrieve the most relevant real jobs using the correct tools and clearly explain the retrieval process.
    `
    },
    { role: "user", content: message }
    ];

  try {

    while (true) {

      sendEvent(res, {
        type: "thinking",
        content: "Reasoning..."
      })

      const completion = await client.chat.completions.create({
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        messages,
        tools
      })

      const msg = completion.choices[0].message

      /* ---------- TOOL CALL ---------- */

      if (msg.tool_calls) {

        messages.push(msg)

        for (const call of msg.tool_calls) {

          const args = JSON.parse(call.function.arguments)

          sendEvent(res, {
            type: "tool_call",
            tool: call.function.name,
            input: args
          })

          const tool = toolByName[call.function.name]
          const result = tool
            ? await tool.handler(args)
            : { error: `Unknown tool: ${call.function.name}` }

          sendEvent(res, result)

          messages.push({
            role: "tool",
            tool_name: call.function.name,
            content: JSON.stringify(result)
          })
        }

        continue
      }

      /* ---------- FINAL RESPONSE ---------- */

      sendEvent(res, {
        type: "message",
        role: "assistant",
        content: msg.content
      })

      break
    }

    closeSSE(res)

  } catch (err) {

    sendEvent(res, {
      type: "error",
      message: err.message
    })

    closeSSE(res)
  }
}