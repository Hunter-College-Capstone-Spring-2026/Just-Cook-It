import { useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "../lib/appConfig";
import {
  analyzeCookedRecipes,
  formatCookedDate,
  formatRequestError,
  inferRecipeCuisines,
  mergeIngredientLists,
} from "../lib/appHelpers";

export default function PantryPage({
  userId,
  initialPantryItems,
  recentlyAdded,
  recipeTitle,
  lastCookedRecipe,
  cookedRecipes,
  onGoHome,
  onResetCooked,
  resettingCooked,
  onResetPantry,
  resettingPantry,
}) {
  const [pantryItems, setPantryItems] = useState(initialPantryItems || []);
  const [addDraft, setAddDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [manualRecentlyAdded, setManualRecentlyAdded] = useState([]);
  const [loading, setLoading] = useState(
    (initialPantryItems || []).length === 0,
  );
  const [error, setError] = useState("");
  const recentItemKeys = useMemo(
    () =>
      new Set(
        mergeIngredientLists(recentlyAdded || [], manualRecentlyAdded)
          .map((item) => item?.trim().toLowerCase())
          .filter(Boolean),
      ),
    [recentlyAdded, manualRecentlyAdded],
  );
  const displayPantryItems = useMemo(
    () => mergeIngredientLists(pantryItems, recentlyAdded || []),
    [pantryItems, recentlyAdded],
  );
  const tasteProfile = useMemo(
    () => analyzeCookedRecipes(cookedRecipes),
    [cookedRecipes],
  );
  const recentCooked = useMemo(
    () =>
      (cookedRecipes || []).slice(0, 6).map((recipe) => ({
        ...recipe,
        cuisineTags: inferRecipeCuisines(recipe),
      })),
    [cookedRecipes],
  );

  useEffect(() => {
    setPantryItems(Array.isArray(initialPantryItems) ? initialPantryItems : []);
  }, [initialPantryItems]);

  useEffect(() => {
    if (!userId) {
      setPantryItems([]);
      setManualRecentlyAdded([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadPantry = async () => {
      setLoading((initialPantryItems || []).length === 0);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/pantry/?userId=${encodeURIComponent(userId)}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.detail || "Could not load pantry.");
        }

        if (!cancelled) {
          setPantryItems(
            Array.isArray(payload.ingredients) ? payload.ingredients : [],
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatRequestError(requestError, "Could not load pantry."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPantry();
    return () => {
      cancelled = true;
    };
  }, [initialPantryItems, userId]);

  const latestCook = lastCookedRecipe || recentCooked[0] || null;
  const headline = recipeTitle || latestCook?.title || "Start cooking";
  const pantryCountLabel = displayPantryItems.length === 1 ? "item" : "items";
  const parsePantryDraft = (value) =>
    value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handleResetCooked = async () => {
    if (cookedRecipes.length === 0 || resettingCooked) return;

    const confirmed = window.confirm("Clear your cooked history?");
    if (!confirmed) return;

    await onResetCooked?.();
  };

  const handleResetPantry = async () => {
    if (displayPantryItems.length === 0 || resettingPantry) return;

    const confirmed = window.confirm("Clear your pantry?");
    if (!confirmed) return;

    setAddError("");

    try {
      const nextPantryItems = await onResetPantry?.();
      setPantryItems(Array.isArray(nextPantryItems) ? nextPantryItems : []);
      setManualRecentlyAdded([]);
      setAddDraft("");
      setError("");
    } catch (resetError) {
      setAddError(formatRequestError(resetError, "Could not clear pantry."));
    }
  };

  const addPantryItems = async () => {
    const nextItems = parsePantryDraft(addDraft);
    if (nextItems.length === 0) {
      setAddError("Enter at least one ingredient.");
      return;
    }

    setAdding(true);
    setAddError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/pantry/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ingredients: nextItems.map((name) => ({ name })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || "Could not add pantry items.");
      }

      setPantryItems((current) =>
        Array.isArray(payload.ingredients)
          ? payload.ingredients
          : mergeIngredientLists(current, nextItems),
      );
      setManualRecentlyAdded((current) =>
        mergeIngredientLists(current, nextItems),
      );
      setAddDraft("");
    } catch (requestError) {
      setAddError(
        formatRequestError(requestError, "Could not add pantry items."),
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <h2 className="section-title">Pantry</h2>
      <p className="sync-line">Stock. Track. Repeat.</p>

      <section className="card gradient-card pantry-dashboard-card pantry-sanctuary-card">
        <div className="pantry-dashboard-top">
          <div className="pantry-sanctuary-copy">
            <p className="pantry-kicker">Kitchen scale</p>
            <h3>{headline}</h3>
            <p className="sync-line pantry-landing-copy">
              {latestCook
                ? formatCookedDate(latestCook.cookedAt)
                : "Cook once to start."}
            </p>
          </div>

          <button type="button" className="plan-btn" onClick={onGoHome}>
            Cook
          </button>
        </div>

        <div className="profile-stat-grid pantry-stat-grid">
          <div className="profile-stat-tile">
            <span className="profile-stat-label">Pantry</span>
            <strong>{displayPantryItems.length}</strong>
            <span className="pantry-count-label">{pantryCountLabel}</span>
          </div>
          <div className="profile-stat-tile">
            <span className="profile-stat-label">Cooked</span>
            <strong>{cookedRecipes.length}</strong>
            <span className="pantry-count-label">recipes</span>
          </div>
          <div className="profile-stat-tile wide">
            <span className="profile-stat-label">Favorite</span>
            <strong>{tasteProfile.favoriteCuisine}</strong>
          </div>
        </div>

        {(recentlyAdded || []).length > 0 ? (
          <div className="pantry-highlight-band">
            <p className="pantry-highlight-label">Just added</p>
            <ul className="pantry-highlight-list">
              {(recentlyAdded || []).map((item) => (
                <li key={item} className="pantry-chip recent">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : displayPantryItems.length === 0 ? (
          <p className="sync-line pantry-landing-copy">No items yet.</p>
        ) : null}
      </section>

      <div className="profile-grid pantry-page-grid">
        <section className="card gradient-card profile-card pantry-history-card">
          <div className="profile-panel-top pantry-catalog-top">
            <h3>Cooked</h3>
            <div className="profile-panel-actions">
              <span className="profile-inline-count">{cookedRecipes.length}</span>
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
                      {recipe.readyInMinutes
                        ? ` • ${recipe.readyInMinutes} min`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sync-line">No dishes yet.</p>
          )}
        </section>

        <section className="card gradient-card pantry-catalog-card">
          <div className="pantry-catalog-top">
            <h3>Pantry</h3>
            <div className="profile-panel-actions">
              <span className="profile-inline-count">
                {displayPantryItems.length}
              </span>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleResetPantry}
                disabled={displayPantryItems.length === 0 || resettingPantry}
              >
                {resettingPantry ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>

          <div className="pantry-add-panel">
            <label htmlFor="pantryAddInput">Add pantry items</label>
            <div className="pantry-add-row">
              <input
                id="pantryAddInput"
                type="text"
                placeholder="milk, garlic, spinach"
                value={addDraft}
                onChange={(event) => setAddDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPantryItems();
                  }
                }}
              />
              <button
                type="button"
                className="secondary-btn pantry-add-btn"
                onClick={addPantryItems}
                disabled={adding}
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
            <p className="field-hint">Use commas to add multiple ingredients.</p>
            {addError ? <p className="error-text pantry-add-error">{addError}</p> : null}
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {loading && displayPantryItems.length === 0 ? (
            <p className="sync-line">Loading pantry...</p>
          ) : null}

          {!loading && displayPantryItems.length === 0 ? (
            <p className="sync-line">No items yet.</p>
          ) : null}

          {displayPantryItems.length > 0 ? (
            <ul className="pantry-catalog-list">
              {displayPantryItems.map((item) => (
                <li
                  key={item}
                  className={`pantry-chip ${
                    recentItemKeys.has(item.trim().toLowerCase())
                      ? "recent"
                      : ""
                  }`}
                >
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}
