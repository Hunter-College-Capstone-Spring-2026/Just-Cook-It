from __future__ import annotations

from fastapi import APIRouter, Query

from services.spoonacular_service import search_recipes_by_ingredients

router = APIRouter(prefix="/api/spoonacular", tags=["spoonacular"])


@router.get("/recipes/search")
def search_recipes(
    ingredients: str = Query(..., description="Comma-separated ingredients"),
    number: int = Query(10, ge=1, le=50),
    ranking: int = Query(1, ge=1, le=2),
    ignorePantry: bool = Query(True),
):
    payload = search_recipes_by_ingredients(
        ingredients=ingredients,
        number=number,
        ranking=ranking,
        ignore_pantry=ignorePantry,
    )

    if not payload["results"]:
        return {"message": "No recipes found for this query.", **payload}

    return payload
