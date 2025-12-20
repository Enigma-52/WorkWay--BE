const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root (optional)
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// Graceful shutdown (optional but recommended)
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});
