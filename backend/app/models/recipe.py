from pydantic import BaseModel

class UserRecipe(BaseModel):
    recipe_id: int
    is_saved: bool
    is_cooked: bool
    rating: int | None
