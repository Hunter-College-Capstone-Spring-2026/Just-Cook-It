from __future__ import annotations

from typing import Any, Dict, List

import requests
from fastapi import HTTPException

from app.config import settings


def _raise_spoonacular_error(resp: requests.Response) -> None:
    if resp.status_code in (401, 402):
        raise HTTPException(status_code=401, detail="Spoonacular key is invalid or quota is exhausted.")
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="Spoonacular rate limit reached. Try again later.")
    raise HTTPException(status_code=502, detail=f"Spoonacular request failed with status {resp.status_code}.")


def search_recipes_by_ingredients(
    ingredients: str,
    number: int = 10,
    ranking: int = 1,
    ignore_pantry: bool = True,
) -> Dict[str, Any]:
    if not settings.spoonacular_api_key:
        raise HTTPException(status_code=500, detail="SPOONACULAR_API_KEY is not configured.")

    if not ingredients.strip():
        raise HTTPException(status_code=400, detail="ingredients is required (comma-separated).")

    url = f"{settings.spoonacular_base_url}/recipes/findByIngredients"
    params = {
        "apiKey": settings.spoonacular_api_key,
        "ingredients": ingredients.strip(),
        "number": number,
        "ranking": ranking,
        "ignorePantry": str(ignore_pantry).lower(),
    }

    try:
        resp = requests.get(url, params=params, timeout=12)
    except requests.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"Unable to reach Spoonacular API: {exc}") from exc

    if resp.status_code >= 400:
        _raise_spoonacular_error(resp)

    data = resp.json()
    results: List[Dict[str, Any]] = data if isinstance(data, list) else []

    mapped = [
        {
            "recipeId": item.get("id"),
            "recipeName": item.get("title"),
            "recipeImageUrl": item.get("image"),
            "usedIngredientCount": item.get("usedIngredientCount", 0),
            "missedIngredientCount": item.get("missedIngredientCount", 0),
            "missedIngredients": [ing.get("name") for ing in item.get("missedIngredients", [])],
        }
        for item in results
    ]

    return {"totalResults": len(mapped), "results": mapped}
