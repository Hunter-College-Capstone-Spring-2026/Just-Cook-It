const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { searchRecipesController } = require("../controllers/spoonacularController");

const router = express.Router();

router.get("/recipes/search", asyncHandler(searchRecipesController));

module.exports = router;
