from __future__ import annotations
import requests
from fastapi import HTTPException
from app.utils.config import settings
from app.services.supabase_service import get_user_profile

def search_recipes_complex(
    user_id: str,
    ingredients: str,
    number: int = 3,
    ranking: int = 1,
    ignore_pantry: bool = True,
    max_ready_time: int | None = None,
):
    url = f"{settings.spoonacular_base_url}/recipes/complexSearch"

    user_profile = get_user_profile(user_id)
    dietary = user_profile.get("dietary", {})

    normalized_ingredients = ",".join(
        [part.strip() for part in ingredients.split(",") if part.strip()]
    )

    params = {
        "apiKey": settings.spoonacular_api_key,
        "includeIngredients": normalized_ingredients,
        "number": number,
        "addRecipeInformation": True,
        "fillIngredients": True,
        "ignorePantry": str(ignore_pantry).lower(),
    }

    # ranking from frontend
    if ranking == 1:
        params["sort"] = "max-used-ingredients"
    else:
        params["sort"] = "min-missing-ingredients"

    # optional max time
    if max_ready_time is not None:
        params["maxReadyTime"] = max_ready_time

    # dietary filtering from user profile
    if dietary.get("vegetarian"):
        params["diet"] = "vegetarian"
    elif dietary.get("vegan"):
        params["diet"] = "vegan"

    if dietary.get("glutenFree"):
        params["intolerances"] = "gluten"

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        raw_results = response.json().get("results", [])
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Spoonacular request failed: {exc}"
        ) from exc

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

def get_recipe_details_by_id(recipe_id: int):
    url = f"{settings.spoonacular_base_url}/recipes/{recipe_id}/information"

    params = {
        "apiKey": settings.spoonacular_api_key
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Spoonacular request failed: {exc}"
        )

    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "image": data.get("image"),
        "readyInMinutes": data.get("readyInMinutes"),
        "extendedIngredients": data.get("extendedIngredients", []),
        "instructions": data.get("instructions")
    }