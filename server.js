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

// Helper function to detect HTML content
function isHtmlResponse(response) {
  // Check content-type header
  const contentType = response.headers?.["content-type"] || "";
  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml")
  ) {
    return true;
  }

  // Check data content if it's a string
  if (typeof response.data === "string") {
    const data = response.data.trim();
    return (
      data.startsWith("<!DOCTYPE") ||
      data.startsWith("<html") ||
      (data.includes("<head") && data.includes("<body"))
    );
  }

  return false;
}

// Helper function to convert HTML response to MCP-like format
function convertHtmlToMcpFormat(htmlContent, url) {
  // Extract title if available
  let title = "Unknown Page";
  const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1];
  }

  // Create a standardized response
  return {
    response: `Converted HTML from ${url}`,
    output: `Page Title: ${title}`,
    model: "html-converter",
    _originalHtml: htmlContent,
    metadata: {
      responseType: "html",
      title: title,
      url: url,
      contentLength: htmlContent.length,
      timestamp: new Date().toISOString(),
    },
  };
}

// Route to test MCP server
app.post("/api/test-mcp", async (req, res) => {
  const { serverUrl, apiKey } = req.body;

  if (!serverUrl) {
    return res
      .status(400)
      .json({ success: false, message: "Server URL is required" });
  }

  try {
    // Test basic connectivity - try HEAD first, fall back to GET if HEAD fails
    let connectivityTest;
    try {
      connectivityTest = await axios.head(serverUrl, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        validateStatus: (status) => true, // Accept any status code to handle properly
      });

      // If we get a 405 Method Not Allowed, retry with GET
      if (connectivityTest.status === 405) {
        console.log("HEAD request not supported, falling back to GET...");
        connectivityTest = await axios.get(serverUrl, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          validateStatus: (status) => true,
          // For GET requests, we don't want the full response body if it's large
          timeout: 10000,
        });
      }
    } catch (error) {
      // If HEAD fails completely (e.g., network error), try GET
      console.log("HEAD request failed, falling back to GET...", error.message);
      connectivityTest = await axios.get(serverUrl, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        validateStatus: (status) => true,
        timeout: 10000,
      });
    }

    // If connectivity test still failed with a critical error, throw
    if (connectivityTest.status >= 500) {
      throw new Error(
        `Server error: ${connectivityTest.status} ${connectivityTest.statusText}`
      );
    }

    // Test functionality by sending a simple request
    const testPayload = {
      input: "Hello, can you respond to confirm you're working?",
      config: {
        max_tokens: 50,
      },
    };

    // For APIs like Exchange Rate API that don't accept POST with our payload format,
    // we'll handle the failure gracefully
    let functionalityTest;
    try {
      functionalityTest = await axios.post(serverUrl, testPayload, {
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        validateStatus: (status) => true, // Accept any status code to handle properly
        // Important for HTML responses
        responseType: "text",
      });

      // If POST fails with 405 Method Not Allowed, try GET instead
      if (functionalityTest.status === 405) {
        console.log("POST request not supported, trying GET...");
        functionalityTest = await axios.get(serverUrl, {
          headers: {
            "Content-Type": "application/json",
            ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
          },
          validateStatus: (status) => true,
          responseType: "text",
        });
      }
    } catch (error) {
      console.log("POST request failed, trying GET...", error.message);
      functionalityTest = await axios.get(serverUrl, {
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        validateStatus: (status) => true,
        responseType: "text",
      });
    }

    // Check if we got any successful response
    const isSuccess =
      (connectivityTest.status >= 200 && connectivityTest.status < 300) ||
      (functionalityTest.status >= 200 && functionalityTest.status < 300);

    // Special handling for HTML responses
    const isHtml = isHtmlResponse(functionalityTest);

    // Create response object
    let responseData = functionalityTest.data;

    // If we have HTML content, pass it through directly instead of converting to MCP format
    if (isHtml && typeof responseData === "string") {
      console.log(
        "Detected HTML response, preserving format for direct display"
      );
    }

    // Try to extract MCP server details if it looks like a JSON response
    let mcpInfo = {
      status: isSuccess ? "success" : "failed",
      message: isSuccess
        ? "MCP server is reachable"
        : "Failed to connect to MCP server",
      server: extractServerName(serverUrl),
      _rawResponse: responseData,
    };

    // Try to parse JSON response and extract features
    if (typeof responseData === "string" && !isHtml) {
      try {
        const parsedData = JSON.parse(responseData);
        if (parsedData) {
          // Look for version info in the response
          if (parsedData.version) {
            mcpInfo.version = parsedData.version;
          } else if (parsedData.model_version) {
            mcpInfo.version = parsedData.model_version;
          } else if (parsedData.model) {
            mcpInfo.version =
              typeof parsedData.model === "string"
                ? parsedData.model
                : "Unknown";
          }

          // Try to determine features
          const features = extractFeatures(parsedData, serverUrl);
          if (features.length > 0) {
            mcpInfo.features = features;
          }
        }
      } catch (e) {
        console.log("Could not parse response as JSON", e.message);
      }
    }

    return res.json({
      success: isSuccess,
      message: isSuccess
        ? isHtml
          ? "Server responded with HTML content (displaying webpage)"
          : "MCP server is reachable"
        : "Server accessible but returned errors",
      connectivity: {
        status: connectivityTest.status,
        statusText: connectivityTest.statusText,
        headers: connectivityTest.headers || {},
      },
      functionality: {
        status: functionalityTest.status,
        statusText: functionalityTest.statusText,
        response: isHtml ? responseData : mcpInfo,
        isHtml: isHtml,
        headers: functionalityTest.headers || {},
      },
    });
  } catch (error) {
    console.error("Error testing server:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to test server",
      error: error.response
        ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            headers: error.response.headers,
          }
        : {
            message: error.message,
          },
    });
  }
});

/**
 * Extract server name from URL
 * @param {string} url - The server URL
 * @returns {string} - Server name
 */
function extractServerName(url) {
  try {
    const urlObj = new URL(url);

    // Check for Smithery servers
    if (urlObj.hostname.includes("smithery.ai")) {
      const match = url.match(/@smithery-ai\/([^\/]+)/);
      if (match && match[1]) {
        // Convert to title case with spaces
        const name = match[1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        return `${name} (Smithery)`;
      }
      return "Smithery MCP Server";
    }

    // Other MCP providers
    return urlObj.hostname || "Unknown MCP Server";
  } catch (e) {
    return "Unknown MCP Server";
  }
}

/**
 * Try to extract features from response
 * @param {Object} data - Parsed response data
 * @param {string} serverUrl - The server URL
 * @returns {Array} - Features list
 */
function extractFeatures(data, serverUrl) {
  const features = [];

  // Check for specific capabilities
  if (data.choices && Array.isArray(data.choices)) {
    features.push("Text Generation");
  }

  if (data.response || data.output || data.completion || data.generated_text) {
    features.push("Text Processing");
  }

  if (data.model && data.model.includes("gpt")) {
    features.push("Language Model");
  }

  // Check for specific model capabilities based on model name or URL
  const modelName = data.model || "";
  if (typeof modelName === "string") {
    if (
      modelName.toLowerCase().includes("sequential") ||
      (serverUrl && serverUrl.toLowerCase().includes("sequential"))
    ) {
      features.push("Sequential Processing");
    }

    if (
      modelName.toLowerCase().includes("reasoning") ||
      data.reasoning ||
      data.thoughts
    ) {
      features.push("AI Reasoning");
    }
  }

  // Add Memory feature if it seems to have memory capabilities
  if (data.memory || data.history || data.conversation_id) {
    features.push("Memory");
  }

  return features;
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
