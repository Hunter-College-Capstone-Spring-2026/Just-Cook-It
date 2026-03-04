# Just-Cook-It Developer Setup

This repo includes:
- A React + Vite frontend
- A Node.js + Express backend
- Supabase integration
- Spoonacular integration using `Search Recipes by Ingredients`

## 1) Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```

Fill `backend/.env`:
```env
PORT=4000
NODE_ENV=development
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_<your_key>
SPOONACULAR_API_KEY=<your_spoonacular_key>
SPOONACULAR_BASE_URL=https://api.spoonacular.com
```

Start backend:
```bash
npm run dev
```

Expected startup logs include:
- `Backend listening on http://localhost:4000`
- `Supabase connection check passed (table access confirmed).`

## 2) Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open:
- `http://localhost:5173`

Optional frontend env (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:4000
```

## Backend API Endpoints
- `GET /api/health`
- `GET /api/db/schema`
- `GET /api/db/:tableName`
- `POST /api/db/:tableName`
- `PATCH /api/db/:tableName`
- `GET /api/spoonacular/recipes/search?ingredients=rice,tomato&number=5&ranking=1&ignorePantry=true`

## Spoonacular Integration
The backend uses Spoonacular's ingredient-based search endpoint:
- `GET /recipes/findByIngredients`

Mapped query params:
- `ingredients` (required, comma-separated)
- `number` (optional, default `10`)
- `ranking` (optional, default `1`)
- `ignorePantry` (optional, default `true`)

## Notes
- Do not commit `.env` files.
- API keys are loaded only from environment variables.
