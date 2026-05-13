import { useMemo } from "react";

import {
  analyzeCookedRecipes,
  buildRecipePreview,
  formatCookedDate,
  inferRecipeCuisines,
} from "../lib/appHelpers";

export default function ProfilePage({
  profile,
  cookedRecipes,
  savedRecipes,
  savedRecipeIds,
  onToggleSaved,
  onOpenRecipe,
  onResetCooked,
  syncMessage,
  resettingCooked,
}) {
  const tasteProfile = useMemo(
    () => analyzeCookedRecipes(cookedRecipes),
    [cookedRecipes],
  );
  const recentCooked = useMemo(
    () =>
      (cookedRecipes || []).slice(0, 5).map((recipe) => ({
        ...recipe,
        cuisineTags: inferRecipeCuisines(recipe),
      })),
    [cookedRecipes],
  );
  const profileTitle = profile.name || "Your kitchen";
  const profileInitial = (profile.name || profile.email || "J")
    .trim()
    .charAt(0)
    .toUpperCase();

  const handleResetCooked = async () => {
    if (cookedRecipes.length === 0 || resettingCooked) return;

    const confirmed = window.confirm("Clear your cooked history?");
    if (!confirmed) return;

    await onResetCooked?.();
  };

  return (
    <>
      <h2 className="section-title">Profile</h2>
      {syncMessage ? <p className="sync-line">{syncMessage}</p> : null}

      <section className="card gradient-card profile-card profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-identity-block">
            <div className="profile-avatar">{profileInitial}</div>
            <div>
              <p className="profile-kicker">Identity</p>
              <h3>{profileTitle}</h3>
              <p className="sync-line">{profile.email || "Add your email"}</p>
            </div>
          </div>

          <div className="profile-stat-grid">
            <div className="profile-stat-tile">
              <span className="profile-stat-label">Cooked</span>
              <strong>{cookedRecipes.length}</strong>
            </div>
            <div className="profile-stat-tile">
              <span className="profile-stat-label">Saved</span>
              <strong>{savedRecipes.length}</strong>
            </div>
            <div className="profile-stat-tile wide">
              <span className="profile-stat-label">Favorite cuisine</span>
              <strong>{tasteProfile.favoriteCuisine}</strong>
            </div>
          </div>
        </div>

        <div className="taste-summary-row">
          <div>
            {/* <p className="profile-kicker">Taste</p>
            <h3>{tasteProfile.favoriteCuisine}</h3> */}
            {/* <p className="sync-line">{tasteProfile.note}</p> */}
          </div>

          {/* {tasteProfile.breakdown.length > 0 ? (
            <div className="taste-chip-row">
              {tasteProfile.breakdown.map((item) => (
                <span key={item.label} className="taste-chip">
                  {item.label} {item.count}
                </span>
              ))}
            </div>
          ) : null} */}
        </div>
      </section>

      <div className="profile-grid">
        <section className="card gradient-card profile-card profile-history-card">
          <div className="profile-panel-top">
            <h3>Cooked</h3>
            <div className="profile-panel-actions">
              <span className="profile-inline-count">
                {cookedRecipes.length}
              </span>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleResetCooked}
                disabled={cookedRecipes.length === 0 || resettingCooked}
              >
                {resettingCooked ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>

          {recentCooked.length > 0 ? (
            <ul className="history-list">
              {recentCooked.map((recipe) => (
                <li
                  key={`${recipe.recipeId}-${recipe.cookedAt}`}
                  className="history-row"
                >
                  {recipe.image ? (
                    <img
                      src={recipe.image}
                      alt={recipe.title}
                      className="history-thumb"
                    />
                  ) : (
                    <div className="history-thumb history-thumb-placeholder">
                      {recipe.title.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="history-copy">
                    <p className="history-title">{recipe.title}</p>
                    <p className="history-meta">
                      {formatCookedDate(recipe.cookedAt)}
                      {recipe.cuisineTags[0]
                        ? ` • ${recipe.cuisineTags[0]}`
                        : ""}
                    </p>
                    <button
                      type="button"
                      className="plan-btn"
                      onClick={() =>
                        onOpenRecipe({
                          id: recipe.recipeId,
                          title: recipe.title,
                          imageUrl: recipe.image || "",
                          readyTime: recipe.readyInMinutes ?? null,
                          cuisines: recipe.cuisines || [],
                          dishTypes: recipe.dishTypes || [],
                        })
                      }
                    >
                      Open recipe
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sync-line">No dishes yet.</p>
          )}
        </section>

        <section className="card gradient-card profile-card profile-card-compact">
          <div className="profile-panel-top">
            <h3>Saved recipes</h3>
            <span className="profile-inline-count">{savedRecipes.length}</span>
          </div>

          {savedRecipes.length > 0 ? (
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
          ) : (
            <p className="sync-line">Save recipes from Home to see them here.</p>
          )}
        </section>
      </div>
    </>
  );
}
