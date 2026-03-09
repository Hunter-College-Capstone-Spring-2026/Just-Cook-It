from fastapi import APIRouter, Query
from app.services.spoonacular_service import search_recipes

router = APIRouter(
    prefix="/recipes",
    tags=["recipes"]
)

@router.get("/")
def get_recipes():
    return {"message": "Recipes route works"}

@router.get("/search")
def search(query: str = Query(...), max_time: int | None = None):
    return search_recipes(query=query, max_ready_time=max_time)