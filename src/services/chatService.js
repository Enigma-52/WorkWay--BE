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
    You retrieve real jobs using tools only. Never invent data.

    STRUCTURED DOMAIN DETECTION

    If the query mentions a field, specialization, or area of work
    (e.g. frontend, backend, AI, finance, marketing, data, security, etc),
    treat it as a domain constraint candidate.

    Always:
    1. Call get_all_domains
    2. Find closest matching domain value
    3. If a match exists → use structured filtering with that domain
    4. If no match exists → do semantic search

    Do NOT skip domain lookup when specialization is mentioned.
    
    DECISION POLICY
    - Validate structured values using helper tools
    - Apply structured filtering if valid
    - If filtering returns zero or irrelevant results → use semantic ranking
    - Rank candidates unless user wants raw results
    
    OUTPUT CONTRACT (STRICT)

    Return ONLY final results formatted in MARKDOWN.

    DO NOT include:
    - reasoning
    - steps
    - tool usage
    - analysis
    - explanations
    - planning text

    If no relevant jobs exist, return exactly:
    No relevant jobs found.

    --------------------
    MARKDOWN FORMAT
    --------------------

    Use this structure:

    ## Matching Jobs

    ### {Job Title}
    **Company:** {Company}  
    **Location:** {Location}  
    **Apply:** {URL}

    --- repeat for each job ---

    RULES
    - One job per block
    - Use clickable markdown links
    - Use clean spacing
    - Do not add commentary
    - Do not add extra sections
    - Do not summarize
    - Use only tool data
    `
    },
    { role: "user", content: message }
    ]

  try {

    while (true) {

      sendEvent(res, {
        type: "thinking",
        content: "Reasoning..."
      })

      const completion = await client.chat.completions.create({
        model: "google/gemini-2.5-flash-lite",
        messages,
        tools
      })

      const msg = completion.choices[0].message

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
            name : call.function.name,
            tool_call_id: call.id,
            content: JSON.stringify(result)
          })
        }

        continue
      }

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