const express = require("express");
const healthRoutes = require("./healthRoutes");
const spoonacularRoutes = require("./spoonacularRoutes");
const dbRoutes = require("./dbRoutes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/spoonacular", spoonacularRoutes);
router.use("/db", dbRoutes);

module.exports = router;
