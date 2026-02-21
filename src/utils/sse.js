// utils/sse.js
export function initSSE(res) {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()
  }
  
  export function sendEvent(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }
  
  export function closeSSE(res) {
    res.end()
  }