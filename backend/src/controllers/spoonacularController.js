const { searchRecipes } = require("../services/spoonacularService");

async function searchRecipesController(req, res) {
  const { query, number } = req.query;

  const payload = await searchRecipes({
    query,
    number: number ? Number(number) : 10
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
