import {
  buildRecipePreview,
  formatCookedDate,
} from "../lib/appHelpers";

export default function FavoritesPage({
  savedRecipes,
  savedRecipeIds,
  onToggleSaved,
  onOpenRecipe,
  onGoHome,
}) {
  const latestSavedRecipe = savedRecipes[0] || null;
  const savedCountLabel = savedRecipes.length === 1 ? "recipe" : "recipes";

  return (
    <>
      <h2 className="section-title">Favorites</h2>
      <p className="sync-line">Save recipes here so they are easy to revisit.</p>

      <section className="card gradient-card favorites-hero-card">
        <div className="favorites-hero-top">
          <div className="favorites-hero-copy">
            <p className="profile-kicker">Recipe box</p>
            <h3>
              {latestSavedRecipe
                ? latestSavedRecipe.title
                : "Your next go-to meals will live here"}
            </h3>
            <p className="sync-line favorites-hero-note">
              {latestSavedRecipe
                ? `Latest save ${formatCookedDate(latestSavedRecipe.savedAt)}.`
                : "Tap the heart on any recipe card to save it for later."}
            </p>
          </div>

          <button type="button" className="plan-btn" onClick={onGoHome}>
            Browse recipes
          </button>
        </div>

        <div className="profile-stat-grid favorites-stat-grid">
          <div className="profile-stat-tile">
            <span className="profile-stat-label">Saved</span>
            <strong>{savedRecipes.length}</strong>
            <span className="pantry-count-label">{savedCountLabel}</span>
          </div>
          <div className="profile-stat-tile">
            <span className="profile-stat-label">Latest</span>
            <strong>
              {latestSavedRecipe
                ? formatCookedDate(latestSavedRecipe.savedAt)
                : "None yet"}
            </strong>
            <span className="pantry-count-label">
              {latestSavedRecipe ? "most recent" : "start saving"}
            </span>
          </div>
          <div className="profile-stat-tile wide">
            <span className="profile-stat-label">Next up</span>
            <strong>
              {latestSavedRecipe
                ? latestSavedRecipe.title
                : "Save a recipe from Home"}
            </strong>
          </div>
        </div>
      </section>

      {savedRecipes.length === 0 ? (
        <section className="card gradient-card favorites-empty-card">
          <p className="profile-kicker">Nothing saved yet</p>
          <h3>Build your recipe box as you browse.</h3>
          <p className="sync-line favorites-empty-copy">
            Favorites you heart on the Home page will show up here instantly.
          </p>
          <button type="button" className="plan-btn" onClick={onGoHome}>
            Find recipes
          </button>
        </section>
      ) : (
        <section className="card gradient-card favorites-list-card">
          <div className="favorites-list-top">
            <h3>Saved recipes</h3>
            <span className="profile-inline-count">{savedRecipes.length}</span>
          </div>

          <ul className="recipe-list favorites-list">
            {savedRecipes.map((recipe) => {
              const recipePreview = buildRecipePreview(recipe);
              if (!recipePreview) return null;

              return (
                <li
                  key={recipe.recipeId}
                  className="recipe-card gradient-card recipe-card-layout favorites-card"
                >
                  <div className="recipe-result-image-wrap">
                    {recipe.image ? (
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="recipe-result-image"
                      />
                    ) : (
                      <div className="recipe-result-image recipe-result-image-placeholder">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="recipe-result-content">
                    <div className="recipe-card-top">
                      <button
                        type="button"
                        className={`save-icon-btn ${
                          savedRecipeIds.includes(recipe.recipeId) ? "saved" : ""
                        }`}
                        onClick={() => onToggleSaved(recipe)}
                        aria-label={
                          savedRecipeIds.includes(recipe.recipeId)
                            ? "Remove from favorites"
                            : "Save recipe"
                        }
                        title={
                          savedRecipeIds.includes(recipe.recipeId)
                            ? "Remove from favorites"
                            : "Save recipe"
                        }
                      >
                        {savedRecipeIds.includes(recipe.recipeId) ? "♥" : "♡"}
                      </button>
                    </div>

                    <p className="recipe-title">{recipe.title}</p>
                    <p className="favorites-meta">
                      Saved {formatCookedDate(recipe.savedAt)}
                      {recipe.readyInMinutes ? ` • ${recipe.readyInMinutes} min` : ""}
                    </p>

                    <button
                      type="button"
                      className="plan-btn"
                      onClick={() => onOpenRecipe(recipePreview)}
                    >
                      Open recipe
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
