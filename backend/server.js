import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

app.get("/api/recipes", async (req, res) => {
  try {
    const { ingredients, diet, maxTime } = req.query;

    const url = new URL(
      "https://api.spoonacular.com/recipes/complexSearch"
    );

    url.searchParams.append("apiKey", process.env.SPOONACULAR_API_KEY);
    url.searchParams.append("includeIngredients", ingredients);
    url.searchParams.append("number", "6");
    url.searchParams.append("addRecipeInformation", "true");

    if (diet) url.searchParams.append("diet", diet);
    if (maxTime) url.searchParams.append("maxReadyTime", maxTime);

    const response = await fetch(url);
    const data = await response.json();

    res.json(data.results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

app.listen(5000, () =>
  console.log("🔥 Backend running on http://localhost:5000")
);
