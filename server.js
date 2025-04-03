const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Route to test MCP server
app.post("/api/test-mcp", async (req, res) => {
  const { serverUrl, apiKey } = req.body;

  if (!serverUrl) {
    return res
      .status(400)
      .json({ success: false, message: "Server URL is required" });
  }

  try {
    // Test basic connectivity
    const connectivityTest = await axios.head(serverUrl, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });

    // Test functionality by sending a simple request
    const testPayload = {
      input: "Hello, can you respond to confirm you're working?",
      config: {
        max_tokens: 50,
      },
    };

    const functionalityTest = await axios.post(serverUrl, testPayload, {
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
    });

    return res.json({
      success: true,
      message: "MCP server is functioning correctly",
      connectivity: {
        status: connectivityTest.status,
        statusText: connectivityTest.statusText,
      },
      functionality: {
        status: functionalityTest.status,
        response: functionalityTest.data,
      },
    });
  } catch (error) {
    console.error("Error testing MCP server:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to test MCP server",
      error: error.response
        ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          }
        : {
            message: error.message,
          },
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
