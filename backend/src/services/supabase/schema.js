const TABLES = {
  USER: "User",
  DIETARY_RESTRICTION: "DietaryRestriction",
  RECIPE: "Recipe",
  INGREDIENT: "Ingredient",
  USER_DIETARY_RESTRICTION: "UserDietaryRestriction",
  USER_RECIPE: "UserRecipe",
  USER_INGREDIENT: "UserIngredient",
  RECIPE_INGREDIENT: "RecipeIngredient"
};

const TABLE_COMMENTS = {
  [TABLES.USER]:
    "Stores user account data (identity, profile display name, password hash, and account creation timestamp).",
  [TABLES.DIETARY_RESTRICTION]:
    "Master lookup table for available dietary restriction labels (e.g., vegetarian, halal).",
  [TABLES.RECIPE]:
    "Stores recipes synced from Spoonacular or created internally (name, image URL, prep time metadata).",
  [TABLES.INGREDIENT]:
    "Stores canonical ingredients and maps each ingredient to Spoonacular's ingredient identifier.",
  [TABLES.USER_DIETARY_RESTRICTION]:
    "Join table mapping users to one or more dietary restrictions.",
  [TABLES.USER_RECIPE]:
    "Tracks user-to-recipe interactions (saved, cooked timestamp, and optional rating).",
  [TABLES.USER_INGREDIENT]:
    "Represents the user's pantry inventory with quantity, unit, and expiration date.",
  [TABLES.RECIPE_INGREDIENT]:
    "Join table between recipes and ingredients including quantity and measurement unit."
};

const TABLE_RELATIONSHIPS = [
  "UserDietaryRestriction.user_id -> User.user_id",
  "UserDietaryRestriction.restriction_id -> DietaryRestriction.restriction_id",
  "UserRecipe.user_id -> User.user_id",
  "UserRecipe.recipe_id -> Recipe.recipe_id",
  "UserIngredient.user_id -> User.user_id",
  "UserIngredient.ingredient_id -> Ingredient.ingredient_id",
  "RecipeIngredient.recipe_id -> Recipe.recipe_id",
  "RecipeIngredient.ingredient_id -> Ingredient.ingredient_id"
];

const SCHEMA_DEFINITION = {
  [TABLES.USER]: {
    primaryKey: ["user_id"],
    columns: {
      user_id: { type: "uuid", required: true },
      user_email: { type: "varchar", required: true },
      user_name: { type: "varchar", required: true },
      user_password_hash: { type: "varchar", required: true },
      user_created_at: { type: "timestamp", required: false }
    }
  },
  [TABLES.DIETARY_RESTRICTION]: {
    primaryKey: ["restriction_id"],
    columns: {
      restriction_id: { type: "integer", required: true },
      dietary_restriction_name: { type: "varchar", required: true }
    }
  },
  [TABLES.RECIPE]: {
    primaryKey: ["recipe_id"],
    columns: {
      recipe_id: { type: "integer", required: true },
      recipe_name: { type: "varchar", required: true },
      recipe_image_url: { type: "varchar", required: false },
      recipe_ready_time: { type: "integer", required: false },
      recipe_created_at: { type: "timestamp", required: false }
    }
  },
  [TABLES.INGREDIENT]: {
    primaryKey: ["ingredient_id"],
    columns: {
      ingredient_id: { type: "integer", required: true },
      ingredient_spoonacular_id: { type: "integer", required: true },
      ingredient_name: { type: "varchar", required: true }
    }
  },
  [TABLES.USER_DIETARY_RESTRICTION]: {
    primaryKey: ["user_id", "restriction_id"],
    columns: {
      user_id: { type: "uuid", required: true },
      restriction_id: { type: "integer", required: true }
    }
  },
  [TABLES.USER_RECIPE]: {
    primaryKey: ["user_recipe_id"],
    columns: {
      user_recipe_id: { type: "integer", required: true },
      user_id: { type: "uuid", required: true },
      recipe_id: { type: "integer", required: true },
      user_recipe_saved_at: { type: "timestamp", required: false },
      user_recipe_cooked_at: { type: "timestamp", required: false },
      user_recipe_rating: { type: "integer", required: false },
      user_recipe_created_at: { type: "timestamp", required: false }
    }
  },
  [TABLES.USER_INGREDIENT]: {
    primaryKey: ["user_pantry_id"],
    columns: {
      user_pantry_id: { type: "integer", required: true },
      user_id: { type: "uuid", required: true },
      ingredient_id: { type: "integer", required: true },
      user_ingredient_quantity: { type: "decimal", required: true },
      user_ingredient_unit: { type: "varchar", required: true },
      user_ingredient_expiration_date: { type: "date", required: false }
    }
  },
  [TABLES.RECIPE_INGREDIENT]: {
    primaryKey: ["recipe_id", "ingredient_id"],
    columns: {
      recipe_id: { type: "integer", required: true },
      ingredient_id: { type: "integer", required: true },
      recipe_ingredient_amount: { type: "decimal", required: false },
      recipe_ingredient_unit: { type: "varchar", required: false }
    }
  }
};

module.exports = {
  TABLES,
  TABLE_COMMENTS,
  TABLE_RELATIONSHIPS,
  SCHEMA_DEFINITION
};
