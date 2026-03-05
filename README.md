# Just-Cook-It Developer Setup

This repo includes:
- Frontend: React + Vite
- Backend: Python + FastAPI
- Supabase connectivity check on backend startup
- Spoonacular integration using Search Recipes by Ingredients

## 1) Backend Setup (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill `backend/.env`:
```env
HOST=0.0.0.0
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_<your_key>
SPOONACULAR_API_KEY=<your_spoonacular_key>
SPOONACULAR_BASE_URL=https://api.spoonacular.com
```

Start backend:
```bash
python main.py
```

## 2) Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open:
- http://localhost:5173

Optional frontend env (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:4000
```

## Backend API Endpoints
- `GET /api/health`
- `GET /api/spoonacular/recipes/search?ingredients=rice,tomato&number=5&ranking=1&ignorePantry=true`
- `GET /api/pantry/` (placeholder)
- `GET /api/users/` (placeholder)

## Spoonacular Notes
Backend calls:
- `GET https://api.spoonacular.com/recipes/findByIngredients`

Mapped params:
- `ingredients` (required, comma-separated)
- `number` (default `10`)
- `ranking` (default `1`)
- `ignorePantry` (default `true`)

## Security Notes
- Do not commit `.env` files.
- Keys are read from environment variables only.
