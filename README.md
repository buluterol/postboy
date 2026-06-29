# Postboy 🚀

Lightweight Postman alternative - Modern API testing tool built with PHP backend and Vanilla JavaScript frontend.

## Features

- ✅ **All HTTP Methods** - GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- ✅ **Request Customization** - Headers, Body (JSON/Form/Raw), Query Parameters
- ✅ **Collections Management** - Save, organize, and manage your API requests
- ✅ **Environment Variables** - Use `{{variables}}` for dynamic values
- ✅ **Authentication** - Support for Bearer Token, Basic Auth, and API Key
- ✅ **Request History** - Keep track of your recent requests
- ✅ **Response Formatting** - View responses in JSON, HTML, or Raw format
- ✅ **Dark/Light Theme** - Easy on the eyes, day or night
- ✅ **CORS Bypass** - Built-in proxy to avoid CORS issues

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules), Tailwind CSS
- **Backend**: PHP 7.4+
- **Storage**: JSON file-based (no database required)

## Installation

### Prerequisites

- PHP 7.4 or higher
- Node.js (for Tailwind CSS build)

### Setup

1. Clone or download this repository

2. Install Tailwind CSS:
```bash
npm install
```

3. Build CSS:
```bash
npm run build:css
```

4. Create data directory:
```bash
mkdir -p data
```

5. Start PHP development server:
```bash
npm run dev
# or
php -S localhost:8000
```

6. Open your browser and navigate to:
```
http://localhost:8000
```

## Usage

### Making Requests

1. Select HTTP method from the dropdown
2. Enter the API URL
3. Add headers, body, or authentication as needed
4. Click **Send** or press `Ctrl+Enter`
5. View the response in the Response panel

### Collections

- Click **Save to Collection** to save a request
- Manage collections from the sidebar
- Click any saved request to load it

### Environment Variables

- Define variables like `{{baseUrl}}`, `{{apiKey}}`
- Use them in URLs, headers, and body
- Switch between different environments

### Keyboard Shortcuts

- `Ctrl+Enter` or `Cmd+Enter` - Send request
- `Ctrl+S` or `Cmd+S` - Save to collection

## File Structure

```
postboy/
├── index.html                  # Main application
├── assets/
│   ├── css/
│   │   ├── style.css          # Tailwind input
│   │   └── output.css         # Generated CSS (gitignored)
│   └── js/
│       ├── app.js             # Application orchestrator
│       ├── components/        # UI components
│       ├── services/          # Business logic
│       └── utils/             # Helper functions
├── api/
│   ├── proxy.php              # HTTP proxy (CORS bypass)
│   ├── collections.php        # Collections CRUD
│   ├── environments.php       # Environment variables CRUD
│   └── history.php            # Request history CRUD
├── config/
│   └── config.php             # PHP configuration
└── data/                      # JSON storage (gitignored)
    ├── collections.json
    ├── environments.json
    └── history.json
```

## Development

### Watch Tailwind CSS changes:
```bash
npm run watch:css
```

### Start development server:
```bash
npm run dev
```

## API Endpoints

### Collections
- `GET /api/collections.php` - List all collections
- `POST /api/collections.php` - Create new collection
- `PUT /api/collections.php?id={id}` - Update collection
- `DELETE /api/collections.php?id={id}` - Delete collection

### Proxy
- `POST /api/proxy.php` - Proxy HTTP requests (all methods)

### Environments
- `GET /api/environments.php` - List environments
- `POST /api/environments.php` - Create environment
- `PUT /api/environments.php?id={id}` - Update environment
- `DELETE /api/environments.php?id={id}` - Delete environment

### History
- `GET /api/history.php` - List request history
- `POST /api/history.php` - Add to history
- `DELETE /api/history.php` - Clear history

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Roadmap

Future features planned:
- Import/Export Postman collections
- Code generation (cURL, JavaScript, etc.)
- Pre-request scripts and tests
- WebSocket support
- GraphQL support
- Multi-user collaboration

---

Built with ❤️ using Vanilla JavaScript and PHP
