# POS - Point of Sale System

A full-featured Point of Sale system inspired by [Aronium POS](https://www.aronium.com/), featuring:

- **Web-hosted server** — deploy to any Node.js hosting platform (Heroku, Railway, Render, VPS, etc.)
- **Offline-first desktop client** — Windows and macOS app built with Electron
- **Automatic sync** — client syncs data with the server whenever an internet connection is available

---

## Architecture

```
┌─────────────────────────┐       ┌──────────────────────────────┐
│   Electron Desktop App  │       │     Express REST API Server   │
│  (Windows / macOS)      │◄─────►│  (Web Hosting / VPS / Cloud)  │
│                         │ Sync  │                              │
│  • React UI             │       │  • Node.js + Express          │
│  • Local SQLite DB      │       │  • SQLite Database            │
│  • Works offline        │       │  • JWT Authentication         │
└─────────────────────────┘       └──────────────────────────────┘
```

---

## Features

### POS Screen
- Product grid with category filtering and search
- Add products to cart with quantity controls
- Customer selection
- Discount and tax calculation
- Cash / Card / Other payment methods
- Change calculation for cash payments
- Receipt summary

### Product Management
- Add, edit, delete products
- SKU and barcode support
- Category assignment
- Cost and selling price
- Inventory stock tracking

### Category Management
- Colour-coded categories
- Used to filter products on POS screen

### Customer Management
- Customer profiles (name, email, phone, address)
- Loyalty points tracking

### Transaction History
- Full sales history with filters
- Per-transaction item breakdown
- Sync status indicator

### Reports
- Daily / weekly / monthly date ranges
- Summary cards: total sales, transaction count, average sale
- Daily breakdown table with CSS bar chart

### Settings
- Store name, phone, address
- Receipt header and footer text
- Tax rate and currency symbol
- Server URL for sync + connection test
- Manual sync button + last sync time

### Sync
- Automatically syncs when online
- Push local changes (new transactions, product/customer edits) to server
- Pull server changes down to local database
- Conflict resolution: higher `updated_at` timestamp wins
- Transactions are immutable once synced

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

---

### Server Setup

```bash
cd server
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env: set a strong JWT_SECRET

# Start the server (development)
npm run dev

# Start the server (production)
npm start
```

The server starts on port **3001** by default (set `PORT` in `.env` to change).

**Default admin credentials:**
- Username: `admin`
- Password: `admin123`

> ⚠️ Change the default password immediately after first login via the Settings screen.

#### Deploying to Web Hosting

The server is a standard Node.js/Express app. Deploy it to any platform that supports Node.js:

| Platform | Notes |
|----------|-------|
| [Railway](https://railway.app/) | Free tier available, auto-detects Node.js |
| [Render](https://render.com/) | Free tier available |
| [Heroku](https://heroku.com/) | Set `JWT_SECRET` as a config var |
| [Fly.io](https://fly.io/) | Good for persistent SQLite |
| VPS (Ubuntu) | Run with `pm2 start src/app.js` |

Set the environment variable `JWT_SECRET` to a long random string on your hosting platform.

---

### Client Setup

#### Development

```bash
cd client
npm install

# Start in development mode (opens Electron + Vite dev server)
npm run dev
```

#### Build for Distribution

```bash
cd client
npm install
npm run dist
```

Built installers will be in `client/dist-electron/`:
- **Windows**: `.exe` NSIS installer
- **macOS**: `.dmg` disk image

#### Configuring the Server URL

1. Open the client app
2. Go to **Settings**
3. Enter your server URL in the **Server Sync** section (e.g. `https://my-pos-server.railway.app`)
4. Enter your **API Token** (JWT token from logging in)
5. Click **Test Connection** to verify
6. Click **Sync Now** to perform the first sync

---

## API Reference

All API endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, returns JWT token |
| POST | `/api/auth/register` | Register new user (admin only) |
| GET | `/api/auth/me` | Get current user info |

All other endpoints require `Authorization: Bearer <token>` header.

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (supports `?search=&category_id=`) |
| GET | `/api/products/:id` | Get product by ID |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Soft-delete product |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| GET | `/api/categories/:id` | Get category |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Soft-delete category |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers (supports `?search=`) |
| GET | `/api/customers/:id` | Get customer |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Soft-delete customer |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions (supports `?from=&to=&customer_id=&limit=`) |
| GET | `/api/transactions/:id` | Get transaction with items |
| POST | `/api/transactions` | Create transaction |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/push` | Push local changes to server |
| GET | `/api/sync/pull?since=<ISO>` | Pull server changes since timestamp |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings` | Update settings |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check (no auth required) |

---

## Project Structure

```
POS/
├── server/                  # Express REST API
│   ├── src/
│   │   ├── app.js           # Express app entry point
│   │   ├── db.js            # SQLite setup and schema
│   │   ├── middleware/
│   │   │   └── auth.js      # JWT authentication middleware
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── products.js
│   │       ├── categories.js
│   │       ├── customers.js
│   │       ├── transactions.js
│   │       ├── settings.js
│   │       └── sync.js
│   ├── package.json
│   └── .env.example
│
└── client/                  # Electron desktop app
    ├── electron/
    │   ├── main.js          # Electron main process + IPC handlers
    │   ├── preload.js       # Context bridge (window.posAPI)
    │   └── db.js            # Local SQLite database
    ├── src/
    │   ├── index.jsx        # React entry point
    │   ├── App.jsx          # Router and routes
    │   ├── App.css          # Global styles (dark theme)
    │   └── components/
    │       ├── Layout.jsx
    │       ├── Sidebar.jsx
    │       ├── POS/POSScreen.jsx
    │       ├── Products/Products.jsx
    │       ├── Categories/Categories.jsx
    │       ├── Customers/Customers.jsx
    │       ├── Transactions/Transactions.jsx
    │       ├── Reports/Reports.jsx
    │       └── Settings/Settings.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## License

MIT
