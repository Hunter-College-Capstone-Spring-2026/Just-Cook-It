from __future__ import annotations
import requests
from fastapi import HTTPException
from app.utils.config import settings
from app.services.supabase_service import (
    get_user_profile,
    get_user_pantry,
    get_user_saved_recipes,
)

def _infer_preferred_cuisine(saved_recipes: list[dict]) -> str | None:
    counts: dict[str, int] = {}

    for recipe in saved_recipes or []:
        cuisines = recipe.get("cuisines") or []
        for cuisine in cuisines:
            if not cuisine:
                continue
            counts[cuisine] = counts.get(cuisine, 0) + 1

    if not counts:
        return None

    return max(counts, key=counts.get)


def get_personalized_recipe_suggestion(
    user_id: str,
    max_ready_time: int | None = None,
):
    user_profile = get_user_profile(user_id) # restrictions, intolerances, etc.
    pantry_items = get_user_pantry(user_id)
    saved_recipes = get_user_saved_recipes(user_id) 

    dietary = user_profile.get("dietary", {}) if isinstance(user_profile, dict) else {}
    preferred_cuisine = _infer_preferred_cuisine(saved_recipes) # can also use cooking history

    if max_ready_time is None:
        # temporary fallback until preferred cook time is stored in DB
        max_ready_time = 30

    params = {
        "apiKey": settings.spoonacular_api_key,
        "number": 1,
        "addRecipeInformation": True,
        "fillIngredients": True,
        "sort": "min-missing-ingredients",
        "maxReadyTime": max_ready_time,
        "ignorePantry": "true",
    }

    if pantry_items:
        params["includeIngredients"] = ",".join(pantry_items)

    if preferred_cuisine:
        params["cuisine"] = preferred_cuisine

    if dietary.get("vegetarian"):
        params["diet"] = "vegetarian"
    elif dietary.get("vegan"):
        params["diet"] = "vegan"

    if dietary.get("glutenFree"):
        params["intolerances"] = "gluten"

    url = f"{settings.spoonacular_base_url}/recipes/complexSearch"

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        raw_results = response.json().get("results", [])
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Spoonacular request failed: {exc}"
        ) from exc

    if not raw_results:
        return {"suggestion": None}

    item = raw_results[0]

    return {
        "suggestion": {
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
            "cuisineHint": preferred_cuisine,
        }
    }








def search_recipes_complex(
    user_id: str,
    ingredients: str | None = None,
    query_text: str | None = None,
    number: int = 3,
    ranking: int = 1,
    ignore_pantry: bool = True,
    max_ready_time: int | None = None
):
    url = f"{settings.spoonacular_base_url}/recipes/complexSearch"

    user_profile = get_user_profile(user_id)
    dietary = user_profile.get("dietary", {})

    normalized_ingredients = ",".join(
        [part.strip() for part in (ingredients or "").split(",") if part.strip()]
    )
    normalized_query = (query_text or "").strip()

    if not normalized_ingredients and not normalized_query:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one ingredient or a natural language query."
        )

    params = {
        "apiKey": settings.spoonacular_api_key,
        "number": number,
        "addRecipeInformation": True,
        "fillIngredients": True,
        "ignorePantry": str(ignore_pantry).lower(),
    }

    if normalized_ingredients:
        params["includeIngredients"] = normalized_ingredients

    if normalized_query:
        params["query"] = normalized_query

    if ranking == 1:
        params["sort"] = "max-used-ingredients"
    else:
        params["sort"] = "min-missing-ingredients"

    if max_ready_time is not None:
        params["maxReadyTime"] = max_ready_time

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
        "instructions": data.get("instructions"),
        "analyzedInstructions": data.get("analyzedInstructions", []),
        "cuisines": data.get("cuisines", []),
        "dishTypes": data.get("dishTypes", []),
    }
