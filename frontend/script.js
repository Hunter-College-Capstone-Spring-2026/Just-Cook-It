const button = document.getElementById("actionBtn");
const input = document.getElementById("userInput");
const output = document.getElementById("output");

button.addEventListener("click", async () => {
  const ingredients = input.value.trim();

  if (!ingredients) {
    output.innerText = "Please enter some ingredients 🍅";
    return;
  }

  output.innerText = "Cooking up ideas… 🍳";

  try {
    const response = await fetch(
      `http://localhost:5000/api/recipes?ingredients=${ingredients}&maxTime=30`
    );

    const recipes = await response.json();
    displayRecipes(recipes);
  } catch (err) {
    output.innerText = "Something went wrong 😢";
  }
});

function displayRecipes(recipes) {
  if (!recipes.length) {
    output.innerText = "No recipes found.";
    return;
  }

  output.innerHTML = "";

  recipes.forEach(recipe => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h3>${recipe.title}</h3>
      <img src="${recipe.image}" alt="${recipe.title}" />
      <p>Ready in ${recipe.readyInMinutes} minutes</p>
      <a href="${recipe.sourceUrl}" target="_blank">View Recipe</a>
    `;

    output.appendChild(card);
  });
}
