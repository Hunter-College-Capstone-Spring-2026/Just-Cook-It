# Just-Cook-It Backend (Second Progress Milestone)

This milestone delivers a complete backend foundation using Node.js + Express, Supabase integration, and Spoonacular integration.

## Backend Features
- Modular Express backend (`config`, `routes`, `controllers`, `services`, `middleware`, `utils`)
- Supabase client integration with environment-based configuration
- Startup Supabase connectivity check
- Reusable Supabase helper functions for `get`, `insert`, and `update`
- Database schema metadata endpoint aligned with the team ERD
- Spoonacular API integration with error handling for invalid keys, rate limits, and empty results

## Folder Structure
```text
backend/
  src/
    app.js
    server.js
    config/
      env.js
      spoonacularClient.js
      supabaseClient.js
    controllers/
      dbController.js
      healthController.js
      spoonacularController.js
    middleware/
      errorHandler.js
    routes/
      dbRoutes.js
      healthRoutes.js
      index.js
      spoonacularRoutes.js
    services/
      spoonacularService.js
      supabase/
        connectionService.js
        dbService.js
        schema.js
    utils/
      asyncHandler.js
  .env.example
  package.json
```

## Setup Instructions
1. Install dependencies:
```bash
cd backend
npm install
```
2. Create your env file from the template:
```bash
cp .env.example .env
```
3. Fill in your keys in `backend/.env`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SPOONACULAR_API_KEY`
4. Start backend in development mode:
```bash
npm run dev
```
5. Or run normally:
```bash
npm start
```

## API Endpoints
- `GET /api/health`: basic health status
- `GET /api/db/schema`: schema metadata, table purpose comments, and relationship list
- `GET /api/db/:tableName`: fetch table rows (supports query filters + limit/order)
- `POST /api/db/:tableName`: insert one or many rows
- `PATCH /api/db/:tableName`: update rows using scoped filters
- `GET /api/spoonacular/recipes/search?query=pasta&number=5`: search recipes from Spoonacular

## Notes
- No API keys are hardcoded in source.
- The backend verifies Supabase table access during startup.
- Use only environment variables for secret/config values.
