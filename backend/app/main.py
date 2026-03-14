from fastapi import FastAPI
from app.utils.config import settings
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Query
from app.routes import recipes, pantry, user, auth
from app.services.supabase_service import get_dietary_restrictions
from app.services.spoonacular_service import search_recipes_by_ingredients

app = FastAPI()

# allow frontend to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# register route modules
app.include_router(recipes.router)
app.include_router(pantry.router)
app.include_router(user.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {"message": "Just Cook It API is running"}


# simple health check
@app.get("/api/health")
def health():
    return {"ok": True}


# DB test endpoint
@app.get("/api/dietary-restrictions")
def dietary_restrictions():
    return get_dietary_restrictions()


@app.get("/api/spoonacular/recipes/search")
def search_recipes_api(
    ingredients: str = Query(..., min_length=1),
    number: int = Query(10, ge=1, le=20),
    ranking: int = Query(1, ge=1, le=2),
    ignorePantry: bool = Query(True),
    maxTime: int | None = Query(None, ge=1, le=300),
):
    return search_recipes_by_ingredients(
        ingredients=ingredients,
        number=number,
        ranking=ranking,
        ignore_pantry=ignorePantry,
        max_ready_time=maxTime,
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
