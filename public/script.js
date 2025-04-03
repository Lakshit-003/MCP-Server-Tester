document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const testForm = document.getElementById("mcp-test-form");
  const serverUrlInput = document.getElementById("server-url");
  const apiKeyInput = document.getElementById("api-key");
  const resultsSection = document.getElementById("results-section");
  const statusText = document.getElementById("status-text");
  const connectivityResults = document.getElementById("connectivity-results");
  const functionalityResults = document.getElementById("functionality-results");
  const errorDetails = document.getElementById("error-details");
  const errorResults = document.getElementById("error-results");
  const loadingOverlay = document.getElementById("loading-overlay");
  const configButtons = document.querySelectorAll(".config-button");

  // Set up event listeners
  testForm.addEventListener("submit", handleFormSubmit);
  configButtons.forEach((button) => {
    button.addEventListener("click", handleQuickConfig);
  });

  /**
   * Handle form submission
   * @param {Event} event - The form submit event
   */
  async function handleFormSubmit(event) {
    event.preventDefault();

    const serverUrl = serverUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!serverUrl) {
      showError("Server URL is required");
      return;
    }

    // Show loading overlay
    loadingOverlay.classList.remove("hidden");

    try {
      const response = await testMcpServer(serverUrl, apiKey);
      displayResults(response);
    } catch (error) {
      handleError(error);
    } finally {
      // Hide loading overlay
      loadingOverlay.classList.add("hidden");
    }
  }

  /**
   * Handle quick configuration button clicks
   * @param {Event} event - The click event
   */
  function handleQuickConfig(event) {
    const serverUrl = event.currentTarget.getAttribute("data-url");
    if (serverUrl) {
      serverUrlInput.value = serverUrl;
    }
  }

  /**
   * Test the MCP server via our backend API
   * @param {string} serverUrl - The MCP server URL
   * @param {string} apiKey - Optional API key
   * @returns {Promise<Object>} - The test results
   */
  async function testMcpServer(serverUrl, apiKey) {
    const response = await fetch("/api/test-mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serverUrl,
        apiKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to test MCP server");
    }

    return response.json();
  }

  /**
   * Format a response based on its content type/structure
   * @param {any} response - The response data
   * @returns {string} - Formatted HTML representation
   */
  function formatResponse(response) {
    if (!response) return '<div class="empty-response">No response data</div>';

    // Handle string responses (common for text-based AI models)
    if (typeof response === "string") {
      // Check if the response is HTML content
      if (
        response.trim().startsWith("<!DOCTYPE") ||
        response.trim().startsWith("<html") ||
        response.trim().startsWith("<?xml") ||
        (response.includes("<head") && response.includes("<body"))
      ) {
        return formatHtmlResponse(response);
      }

      return `<div class="ai-response">${escapeHtml(response).replace(
        /\n/g,
        "<br>"
      )}</div>`;
    }

    // Handle currency exchange rate API responses or similar structured data
    if (response.conversion_rates || response.rates) {
      return formatExchangeRates(response);
    }

    // Handle typical MCP AI model responses
    if (
      response.response ||
      response.output ||
      response.completion ||
      response.generated_text ||
      response.choices
    ) {
      return formatAIResponse(response);
    }

    // Handle potential HTML response that was parsed as JSON
    if (
      response._html ||
      (typeof response === "object" &&
        Object.keys(response).length === 1 &&
        typeof Object.values(response)[0] === "string" &&
        Object.values(response)[0].includes("<!DOCTYPE html>"))
    ) {
      const htmlContent = response._html || Object.values(response)[0];
      return formatHtmlResponse(htmlContent);
    }

    // Default to pretty JSON for any other object
    return `<div class="json-response">
      <pre>${JSON.stringify(response, null, 2)}</pre>
    </div>`;
  }

  /**
   * Format HTML response data
   * @param {string} htmlContent - HTML string to format
   * @returns {string} - Formatted HTML display
   */
  function formatHtmlResponse(htmlContent) {
    // Extract title if available
    let title = "Unknown Page";
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1];
    }

    // Create a standardized MCP-like response object for metadata
    const mcpStyleResponse = {
      responseType: "html",
      title: title,
      contentLength: htmlContent.length,
      timestamp: new Date().toISOString(),
    };

    // Create an iframe to show the actual rendering
    const iframeSection = `
      <div class="html-preview-container">
        <h4>Webpage Rendering:</h4>
        <iframe 
          class="html-preview-frame" 
          sandbox="allow-same-origin" 
          srcdoc="${escapeHtml(htmlContent)}"
        ></iframe>
      </div>
    `;

    // Create collapsible sections for metadata and raw HTML
    const metadataSection = `
      <details class="response-metadata">
        <summary>Response Metadata</summary>
        <pre>${JSON.stringify(mcpStyleResponse, null, 2)}</pre>
      </details>
    `;

    const rawHtmlSection = `
      <details class="html-source">
        <summary>View HTML Source</summary>
        <pre class="html-code">${escapeHtml(htmlContent)}</pre>
      </details>
    `;

    return `
      <div class="html-response">
        <div class="html-info">
          <p><strong>Server Response:</strong> Web Page - ${title}</p>
        </div>
        ${iframeSection}
        <div class="metadata-controls">
          ${metadataSection}
          ${rawHtmlSection}
        </div>
      </div>
    `;
  }

  /**
   * Format AI model responses
   * @param {Object} response - The AI response object
   * @returns {string} - Formatted HTML
   */
  function formatAIResponse(response) {
    // Check if this is a formatted MCP server test result
    if (response.status && response.server) {
      return formatMcpServerInfo(response);
    }

    let content = "";

    // Handle OpenAI-like responses
    if (response.choices && Array.isArray(response.choices)) {
      const choiceContent =
        response.choices[0]?.message?.content ||
        response.choices[0]?.text ||
        response.choices[0]?.content ||
        JSON.stringify(response.choices[0]);
      content = `<div class="ai-message">${escapeHtml(choiceContent).replace(
        /\n/g,
        "<br>"
      )}</div>`;
    }
    // Handle direct response formats
    else if (
      response.response ||
      response.output ||
      response.completion ||
      response.generated_text
    ) {
      const text =
        response.response ||
        response.output ||
        response.completion ||
        response.generated_text;
      content = `<div class="ai-message">${escapeHtml(text).replace(
        /\n/g,
        "<br>"
      )}</div>`;
    }

    // Add model info if available
    let modelInfo = "";
    if (response.model) {
      modelInfo = `<div class="model-info">Model: ${response.model}</div>`;
    }

    // Add metadata section with collapsible JSON
    const metadataSection = `
      <details class="response-metadata">
        <summary>Response Metadata</summary>
        <pre>${JSON.stringify(response, null, 2)}</pre>
      </details>
    `;

    return `
      <div class="ai-response-container">
        ${modelInfo}
        ${content}
        ${metadataSection}
      </div>
    `;
  }

  /**
   * Format MCP server info in a structured format
   * @param {Object} mcpInfo - The MCP server info
   * @returns {string} - Formatted HTML
   */
  function formatMcpServerInfo(mcpInfo) {
    // Create the badge style based on status
    const statusBadgeClass =
      mcpInfo.status === "success" ? "status-success" : "status-failed";

    // Format features if available
    let featuresHtml = "";
    if (mcpInfo.features && mcpInfo.features.length > 0) {
      const featureBadges = mcpInfo.features
        .map((feature) => `<span class="feature-badge">${feature}</span>`)
        .join("");
      featuresHtml = `
        <div class="mcp-features">
          <h3>Features</h3>
          <div class="feature-badges">
            ${featureBadges}
          </div>
        </div>
      `;
    }

    // Create the version display
    const versionHtml = mcpInfo.version
      ? `<div class="version-info">Version: ${mcpInfo.version}</div>`
      : "";

    // Create the raw response display in a collapsible section
    const rawResponseHtml = mcpInfo._rawResponse
      ? `<details class="response-metadata">
        <summary>Raw Response</summary>
        <pre>${
          typeof mcpInfo._rawResponse === "string"
            ? escapeHtml(mcpInfo._rawResponse)
            : JSON.stringify(mcpInfo._rawResponse, null, 2)
        }</pre>
      </details>`
      : "";

    return `
      <div class="mcp-server-info">
        <div class="mcp-status-header">
          <span class="status-badge ${statusBadgeClass}">${mcpInfo.status}</span>
          <h2 class="mcp-name">${mcpInfo.server}</h2>
        </div>
        
        <div class="mcp-message">${mcpInfo.message}</div>
        ${versionHtml}
        ${featuresHtml}
        ${rawResponseHtml}
      </div>
    `;
  }

  /**
   * Format exchange rate API responses
   * @param {Object} response - Exchange rate data
   * @returns {string} - Formatted HTML table
   */
  function formatExchangeRates(response) {
    const rates = response.conversion_rates || response.rates || {};
    const baseCode = response.base_code || response.base || "Unknown";
    const lastUpdate =
      response.time_last_update_utc || response.date || "Unknown";

    // Create table rows for rates
    const rateRows = Object.entries(rates)
      .map(
        ([currency, rate]) => `
        <tr>
          <td>${currency}</td>
          <td>${rate}</td>
        </tr>
      `
      )
      .join("");

    return `
      <div class="exchange-rates">
        <div class="rate-info">
          <p><strong>Base Currency:</strong> ${baseCode}</p>
          <p><strong>Last Updated:</strong> ${lastUpdate}</p>
        </div>
        
        <details>
          <summary>View All Exchange Rates</summary>
          <div class="rates-table-container">
            <table class="rates-table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                ${rateRows}
              </tbody>
            </table>
          </div>
        </details>
        
        <details class="response-metadata">
          <summary>Response Metadata</summary>
          <pre>${JSON.stringify(response, null, 2)}</pre>
        </details>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} unsafe - Unsafe string
   * @returns {string} - Safe string
   */
  function escapeHtml(unsafe) {
    if (typeof unsafe !== "string") return String(unsafe);
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Display the test results in the UI
   * @param {Object} data - The test results data
   */
  function displayResults(data) {
    // Show results section
    resultsSection.style.display = "block";

    // Reset previous results
    errorDetails.style.display = "none";

    if (data.success) {
      // Update status indicator
      resultsSection.classList.remove("error", "pending");
      resultsSection.classList.add("success");
      statusText.textContent =
        data.message || "MCP server is functioning correctly";

      // Display connectivity results
      connectivityResults.innerHTML = `
        <p><strong>Status:</strong> ${data.connectivity.status} ${data.connectivity.statusText}</p>
        <p><strong>Result:</strong> Connection successful</p>
      `;

      // Display functionality results with improved formatting
      functionalityResults.innerHTML = `
        <p><strong>Status:</strong> ${data.functionality.status}</p>
        <p><strong>Response:</strong></p>
        <div class="response-container">
          ${formatResponse(data.functionality.response)}
        </div>
      `;
    } else {
      // Update status indicator for error
      resultsSection.classList.remove("success", "pending");
      resultsSection.classList.add("error");
      statusText.textContent = data.message || "Failed to test MCP server";

      // Show error details section
      errorDetails.style.display = "block";

      // Display error information
      if (data.error) {
        errorResults.innerHTML = `
          <p><strong>Error:</strong> ${data.message || "Unknown error"}</p>
          ${
            data.error.status
              ? `<p><strong>Status:</strong> ${data.error.status} ${
                  data.error.statusText || ""
                }</p>`
              : ""
          }
          ${data.error.data ? formatResponse(data.error.data) : ""}
        `;
      } else {
        errorResults.innerHTML = `<p><strong>Error:</strong> ${
          data.message || "Unknown error"
        }</p>`;
      }

      // Clear other results
      connectivityResults.innerHTML = "<p>Connectivity test failed</p>";
      functionalityResults.innerHTML = "<p>Functionality test failed</p>";
    }

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: "smooth" });
  }

  /**
   * Handle errors from the API
   * @param {Error} error - The error object
   */
  function handleError(error) {
    // Show results section with error state
    resultsSection.style.display = "block";
    resultsSection.classList.remove("success", "pending");
    resultsSection.classList.add("error");

    // Update status text
    statusText.textContent = "Error testing MCP server";

    // Show error details
    errorDetails.style.display = "block";
    errorResults.innerHTML = `<p><strong>Error:</strong> ${
      error.message || "Unknown error occurred"
    }</p>`;

    // Clear other results
    connectivityResults.innerHTML = "<p>Connectivity test failed</p>";
    functionalityResults.innerHTML = "<p>Functionality test failed</p>";

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: "smooth" });
  }

  /**
   * Show a simple error message
   * @param {string} message - The error message
   */
  function showError(message) {
    alert(message);
  }
});
