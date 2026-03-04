const env = require("../config/env");
const { spoonacularClient } = require("../config/spoonacularClient");

function mapSpoonacularError(error) {
  const status = error.response?.status;

  if (status === 401 || status === 402) {
    const friendly = new Error("Spoonacular key is invalid or has reached its plan limit.");
    friendly.statusCode = 401;
    throw friendly;
  }

  if (status === 429) {
    const friendly = new Error("Spoonacular rate limit reached. Please try again later.");
    friendly.statusCode = 429;
    throw friendly;
  }

  if (status) {
    const friendly = new Error(`Spoonacular request failed with status ${status}.`);
    friendly.statusCode = 502;
    throw friendly;
  }

  const friendly = new Error("Unable to reach Spoonacular API.");
  friendly.statusCode = 503;
  throw friendly;
}

function assertSpoonacularKey() {
  if (!env.spoonacularApiKey) {
    const error = new Error("SPOONACULAR_API_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }
}

async function searchRecipesByIngredients({
  ingredients,
  number = 10,
  ranking = 1,
  ignorePantry = true
}) {
  assertSpoonacularKey();

  if (!ingredients || !ingredients.trim()) {
    const error = new Error("Ingredients are required (comma-separated).");
    error.statusCode = 400;
    throw error;
  }

  try {
    const { data } = await spoonacularClient.get("/recipes/findByIngredients", {
      params: {
        apiKey: env.spoonacularApiKey,
        ingredients: ingredients.trim(),
        number,
        ranking,
        ignorePantry
      }
    });

    const results = Array.isArray(data) ? data : [];

    return {
      totalResults: results.length,
      results: results.map((item) => ({
        recipeId: item.id,
        recipeName: item.title,
        recipeImageUrl: item.image,
        usedIngredientCount: item.usedIngredientCount ?? 0,
        missedIngredientCount: item.missedIngredientCount ?? 0,
        missedIngredients: (item.missedIngredients || []).map((ingredient) => ingredient.name)
      }))
    };
  } catch (error) {
    mapSpoonacularError(error);
  }
}

module.exports = {
  searchRecipesByIngredients
};
