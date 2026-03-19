from fastapi import APIRouter, Query, HTTPException
import requests
from app.utils.config import settings

from app.services.spoonacular_service import (
    search_recipes,
    search_recipes_by_ingredients,
    get_recipe_details_by_id
)

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


@router.get("/api/spoonacular/recipes/search")
def search_by_ingredients(
    ingredients: str = Query(..., min_length=1),
    number: int = Query(10, ge=1, le=20),
    ranking: int = Query(1, ge=1, le=2),
    ignorePantry: bool = Query(True),
    maxTime: int | None = Query(None, ge=1, le=300)
):
    return search_recipes_by_ingredients(
        ingredients=ingredients,
        number=number,
        ranking=ranking,
        ignore_pantry=ignorePantry,
        max_ready_time=maxTime
    )

@router.get("/api/spoonacular/recipes/{recipe_id}")
def get_recipe_details(recipe_id: int):
    return get_recipe_details_by_id(recipe_id)
