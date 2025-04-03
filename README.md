# MCP Server Tester

A web application for testing MCP (Model Completion Provider) server configurations. This tool allows you to verify connectivity and functionality of MCP servers from marketplaces like [Smithery](https://smithery.ai/).

## Features

- Test connectivity with any MCP server
- Verify server functionality with sample requests
- Support for authenticated servers (API keys)
- Quick configuration options for common servers
- Clear, user-friendly interface with detailed results
- Proper error handling and user feedback

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the application:
   ```
   npm start
   ```

## Development

To run the application in development mode with automatic reloading:

```
npm run dev
```

## Usage

1. Open the application in your browser (default: http://localhost:3000)
2. Enter the MCP server URL (required)
3. If the server requires authentication, enter your API key
4. Click "Test Server" to verify connectivity and functionality
5. View detailed results showing server response

### Example Server

The application includes a pre-configured button for the Sequential Thinking MCP server from Smithery:

```
https://smithery.ai/server/@smithery-ai/server-sequential-thinking
```

You can use this as a test case to verify the application is working correctly.

## Technologies

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **HTTP Client**: Axios
- **CORS Support**: Cross-Origin Resource Sharing enabled

## License

ISC
