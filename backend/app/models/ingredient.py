from pydantic import BaseModel


class UserIngredient(BaseModel):
    ingredient_id: int
    ingredient_name: str


class PantryIngredient(BaseModel):
    name: str


class PantryAddRequest(BaseModel):
    user_id: str
    ingredients: list[PantryIngredient]


class PantryRemoveRequest(BaseModel):
    user_id: str
    ingredient_name: str


class CookedRecipePayload(BaseModel):
    recipeId: int
    title: str
    image: str = ""
    readyInMinutes: int | None = None
    cuisines: list[str] = []
    dishTypes: list[str] = []
    cookedAt: str = ""


class CookRecipeRequest(BaseModel):
    """
    Payload for POST /api/pantry/cook.
    Adds ingredients to pantry and records the cooked event atomically.
    """
    user_id: str
    ingredients: list[PantryIngredient]
    recipe: CookedRecipePayload | None = None


class SaveRecipeRequest(BaseModel):
    user_id: str
    recipe: CookedRecipePayload  # reuse the same minimal shape