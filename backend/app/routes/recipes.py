from fastapi import APIRouter, Query, HTTPException
import requests
from app.utils.config import settings
from app.models.ingredient import SaveRecipeRequest
from app.services.supabase_service import toggle_saved_recipe, get_user_saved_recipes

from app.services.spoonacular_service import (
    search_recipes_complex,
    search_recipes_by_ingredients,
    get_recipe_details_by_id,
    get_personalized_recipe_suggestion,
)

router = APIRouter(
    prefix="/recipes",
    tags=["recipes"]
)

@router.get("/")
def get_recipes():
    return {"message": "Recipes route works"}

@router.get("/search")
def search_recipes_endpoint(
    userId: str = Query(...),
    ingredients: str | None = Query(None),
    query: str | None = Query(None),
    number: int = Query(3, ge=1, le=20), #TODO: change number later
    ranking: int = Query(1, ge=1, le=2),
    ignorePantry: bool = Query(True),
    maxTime: int | None = Query(None, ge=1, le=300)
):
    return search_recipes_complex(
        user_id=userId,
        ingredients=ingredients,
        query_text=query,
        number=number,
        ranking=ranking,
        ignore_pantry=ignorePantry,
        max_ready_time=maxTime
    )


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


@router.post("/save")
def save_recipe(payload: SaveRecipeRequest):
    result = toggle_saved_recipe(payload.user_id, payload.recipe.model_dump())
    return {"ok": True, **result}

@router.get("/saved")
def get_saved_recipes(userId: str = Query(..., min_length=3)):
    return {"userId": userId, "recipes": get_user_saved_recipes(userId)}

@router.get("/suggestion")
def get_recipe_suggestion(
    userId: str = Query(..., min_length=3),
    maxTime: int | None = Query(None, ge=1, le=300),
):
    return get_personalized_recipe_suggestion(
        user_id=userId,
        max_ready_time=maxTime,
    )