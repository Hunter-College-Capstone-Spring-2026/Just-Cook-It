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
