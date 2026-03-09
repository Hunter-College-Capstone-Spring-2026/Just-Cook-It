from pydantic import BaseModel

class UserIngredient(BaseModel):
    ingredient_id: int
    ingredient_name: str