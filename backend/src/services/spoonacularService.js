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

async function searchRecipes({ query, number = 10 }) {
  assertSpoonacularKey();

  if (!query || !query.trim()) {
    const error = new Error("Query is required for recipe search.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const { data } = await spoonacularClient.get("/recipes/complexSearch", {
      params: {
        apiKey: env.spoonacularApiKey,
        query: query.trim(),
        number
      }
    });

    const results = data.results || [];

    return {
      totalResults: data.totalResults || 0,
      results: results.map((item) => ({
        recipeId: item.id,
        recipeName: item.title,
        recipeImageUrl: item.image,
        recipe_ready_time: item.readyInMinutes ?? null
      }))
    };
  } catch (error) {
    mapSpoonacularError(error);
  }
}

module.exports = {
  searchRecipes
};
