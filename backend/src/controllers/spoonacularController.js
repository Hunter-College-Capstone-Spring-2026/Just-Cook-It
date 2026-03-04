const { searchRecipesByIngredients } = require("../services/spoonacularService");

async function searchRecipesController(req, res) {
  const { ingredients, number, ranking, ignorePantry } = req.query;

  const payload = await searchRecipesByIngredients({
    ingredients,
    number: number ? Number(number) : 10,
    ranking: ranking ? Number(ranking) : 1,
    ignorePantry: ignorePantry ? ignorePantry === "true" : true
  });

  if (!payload.results.length) {
    return res.status(200).json({
      message: "No recipes found for this query.",
      ...payload
    });
  }

  return res.status(200).json(payload);
}

module.exports = { searchRecipesController };
