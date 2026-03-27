from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "4000"))
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    # Supabase
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_user_table: str = os.getenv("SUPABASE_USER_TABLE", "User")
    supabase_state_table: str = os.getenv("SUPABASE_STATE_TABLE", "UserAppState")
    supabase_dietary_restriction_table: str = os.getenv("SUPABASE_DIETARY_RESTRICTION_TABLE", "DietaryRestriction")
    supabase_user_dietary_table: str = os.getenv("SUPABASE_USER_DIETARY_TABLE", "UserDietaryRestriction")
    supabase_ingredient_table: str = os.getenv("SUPABASE_INGREDIENT_TABLE", "Ingredient")
    supabase_user_ingredient_table: str = os.getenv("SUPABASE_USER_INGREDIENT_TABLE", "UserIngredient")

    # Spoonacular
    spoonacular_api_key: str = os.getenv("SPOONACULAR_API_KEY", "")
    spoonacular_base_url: str = os.getenv("SPOONACULAR_BASE_URL", "https://api.spoonacular.com")


settings = Settings()
