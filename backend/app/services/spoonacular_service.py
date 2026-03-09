import requests
from app.utils.config import SPOONACULAR_API_KEY

BASE_URL = "https://api.spoonacular.com"

def search_recipes(query: str, max_ready_time: int | None = None):
    url = f"{BASE_URL}/recipes/complexSearch"

    params = {
        "apiKey": SPOONACULAR_API_KEY,
        "query": query,
        "addRecipeInformation": True
    }

    if max_ready_time is not None:
        params["maxReadyTime"] = max_ready_time

    response = requests.get(url, params=params)
    response.raise_for_status()

    return response.json()