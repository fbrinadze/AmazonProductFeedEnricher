# Amazon Product Data Enrichment Tool

A full-stack web application for uploading, validating, and enriching product data for Amazon Seller Central.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Frontend**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Testing**: Vitest + fast-check (property-based testing)

## Project Structure

```
.
├── backend/          # Node.js/Express backend
│   ├── src/         # Source code
│   ├── prisma/      # Database schema and migrations
│   └── package.json
├── frontend/         # React frontend
│   ├── src/         # Source code
│   └── package.json
└── package.json      # Root workspace configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Frontend
cp frontend/.env.example frontend/.env
```

3. Set up the database:
```bash
cd backend
npm run prisma:migrate
```

### Development

Run both backend and frontend in development mode:
```bash
npm run dev
```

Or run them separately:
```bash
# Backend (runs on port 3001)
npm run dev:backend

# Frontend (runs on port 5173)
npm run dev:frontend
```

### Testing

Run tests for all workspaces:
```bash
npm test
```

### Building

Build both backend and frontend:
```bash
npm run build
```

## Features

- User authentication with JWT
- File upload (CSV, Excel)
- Data validation against Amazon requirements
- Data enrichment suggestions
- Spreadsheet-style review interface
- Export to Amazon flat file format
- Admin configuration panel

## License

Private - BCI Brands
