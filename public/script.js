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

      // Display functionality results
      functionalityResults.innerHTML = `
        <p><strong>Status:</strong> ${data.functionality.status}</p>
        <p><strong>Response:</strong></p>
        <pre>${JSON.stringify(data.functionality.response, null, 2)}</pre>
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
          ${
            data.error.data
              ? `<pre>${JSON.stringify(data.error.data, null, 2)}</pre>`
              : ""
          }
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
