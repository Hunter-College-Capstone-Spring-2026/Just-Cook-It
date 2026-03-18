from __future__ import annotations

import requests
from fastapi import HTTPException

from app.utils.config import settings


def search_recipes(query: str, max_ready_time: int | None = None):
    url = f"{settings.spoonacular_base_url}/recipes/complexSearch"
    params = {
        "apiKey": settings.spoonacular_api_key,
        "query": query,
        "addRecipeInformation": True
    }

    if max_ready_time is not None:
        params["maxReadyTime"] = max_ready_time

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Spoonacular request failed: {exc}") from exc


def search_recipes_by_ingredients(
    ingredients: str,
    number: int = 10,
    ranking: int = 1,
    ignore_pantry: bool = True,
    max_ready_time: int | None = None
):
    url = f"{settings.spoonacular_base_url}/recipes/findByIngredients"

    params = {
        "apiKey": settings.spoonacular_api_key,
        "ingredients": ingredients,
        "number": number,
        "ranking": ranking,
        "ignorePantry": str(ignore_pantry).lower(),
        "addRecipeInformation": True
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        raw_results = response.json()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Spoonacular request failed: {exc}")

    # time filtering
    if max_ready_time is not None:
        raw_results = [
            r for r in raw_results
            if r.get("readyInMinutes") and r["readyInMinutes"] <= max_ready_time
        ]

    return {
        "results": [
            {
                "recipeId": item.get("id"),
                "recipeName": item.get("title"),
                "recipeImageUrl": item.get("image"),
                "readyInMinutes": item.get("readyInMinutes"),
                "usedIngredientCount": item.get("usedIngredientCount", 0),
                "missedIngredientCount": item.get("missedIngredientCount", 0),
                "missedIngredients": [
                    ing.get("name")
                    for ing in item.get("missedIngredients", [])
                    if ing.get("name")
                ],
                "usedIngredients": [
                    ing.get("name")
                    for ing in item.get("usedIngredients", [])
                    if ing.get("name")
                ],
                "allIngredients": [
                    ing.get("name")
                    for ing in (
                        (item.get("usedIngredients", []) or [])
                        + (item.get("missedIngredients", []) or [])
                    )
                    if ing.get("name")
                ],
            }
            for item in raw_results
        ]
    }
