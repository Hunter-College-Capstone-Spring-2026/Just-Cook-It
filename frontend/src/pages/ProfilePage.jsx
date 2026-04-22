import { useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "../lib/appConfig";
import {
  analyzeCookedRecipes,
  formatCookedDate,
  formatRequestError,
  inferRecipeCuisines,
} from "../lib/appHelpers";

export default function ProfilePage({
  userId,
  profile,
  setProfile,
  settings,
  cookedRecipes,
  onResetCooked,
  onSave,
  syncMessage,
  saving,
  resettingCooked,
}) {
  const [restrictions, setRestrictions] = useState([]);
  const [pantryItems, setPantryItems] = useState([]);
  const [recipeIdeas, setRecipeIdeas] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState("");
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

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/dietary-restrictions`)
      .then((r) => r.json())
      .then((data) => setRestrictions(Array.isArray(data) ? data : []))
      .catch(() => setRestrictions([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPantry = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/pantry/?userId=${encodeURIComponent(userId)}`,
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) {
          setPantryItems(
            Array.isArray(payload.ingredients) ? payload.ingredients : [],
          );
        }
      } catch {
        if (!cancelled) setPantryItems([]);
      }
    };
    if (userId) loadPantry();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!settings.smartSuggestions) {
      setRecipeIdeas([]);
      setIdeasError("");
      setIdeasLoading(false);
      return;
    }

    if (pantryItems.length === 0) {
      setRecipeIdeas([]);
      setIdeasError("");
      return;
    }

    let cancelled = false;
    const loadIdeas = async () => {
      setIdeasLoading(true);
      setIdeasError("");

      try {
        const query = new URLSearchParams({
          userId,
          number: String(settings.quickRecipes ? 3 : 5),
          ranking: "2",
          ignorePantry: "true",
        });

        if (pantryItems.length > 0) {
          query.set("ingredients", pantryItems.join(","));
        }

        const response = await fetch(
          `${API_BASE_URL}/recipes/search?${query.toString()}`,
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ||
              payload?.detail ||
              "Could not load recipe ideas.",
          );
        }

        if (!cancelled) {
          setRecipeIdeas(payload.results || []);
        }
      } catch (error) {
        if (!cancelled) {
          setRecipeIdeas([]);
          setIdeasError(
            formatRequestError(error, "Could not load recipe ideas."),
          );
        }
      } finally {
        if (!cancelled) setIdeasLoading(false);
      }
    };

    loadIdeas();
    return () => {
      cancelled = true;
    };
  }, [pantryItems, settings.quickRecipes, settings.smartSuggestions, userId]);

  const updateDietary = (name) => {
    setProfile((current) => ({
      ...current,
      dietary: { ...current.dietary, [name]: !current.dietary[name] },
    }));
  };

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
              <span className="profile-stat-label">Pantry</span>
              <strong>{pantryItems.length}</strong>
            </div>
            <div className="profile-stat-tile wide">
              <span className="profile-stat-label">Favorite cuisine</span>
              <strong>{tasteProfile.favoriteCuisine}</strong>
            </div>
          </div>
        </div>

        <div className="taste-summary-row">
          <div>
            <p className="profile-kicker">Taste</p>
            <h3>{tasteProfile.favoriteCuisine}</h3>
            <p className="sync-line">{tasteProfile.note}</p>
          </div>

          {tasteProfile.breakdown.length > 0 ? (
            <div className="taste-chip-row">
              {tasteProfile.breakdown.map((item) => (
                <span key={item.label} className="taste-chip">
                  {item.label} {item.count}
                </span>
              ))}
            </div>
          ) : null}
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
            <h3>Next</h3>
            <span className="profile-inline-count">{recipeIdeas.length}</span>
          </div>

          {!settings.smartSuggestions ? (
            <p className="sync-line">
              Turn on Smart suggestions in Settings to get personalized pantry
              ideas here.
            </p>
          ) : null}

          {settings.smartSuggestions && ideasLoading ? (
            <p className="sync-line">Finding ideas...</p>
          ) : null}
          {settings.smartSuggestions && ideasError ? (
            <p className="error-text">{ideasError}</p>
          ) : null}

          {settings.smartSuggestions &&
          !ideasLoading &&
          !ideasError &&
          pantryItems.length === 0 ? (
            <p className="sync-line">Cook once to unlock this.</p>
          ) : null}

          {settings.smartSuggestions &&
          !ideasLoading &&
          !ideasError &&
          pantryItems.length > 0 ? (
            recipeIdeas.length > 0 ? (
              <ul className="profile-mini-list">
                {recipeIdeas.slice(0, 4).map((recipe) => (
                  <li key={recipe.recipeId} className="profile-mini-row">
                    <span className="profile-mini-title">
                      {recipe.recipeName}
                    </span>
                    <span className="profile-mini-meta">
                      {recipe.readyInMinutes ?? "?"} min
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sync-line">No matches yet.</p>
            )
          ) : null}
        </section>
      </div>

      <section className="card gradient-card profile-card">
        <div className="profile-panel-top">
          <h3>Profile notes</h3>
        </div>

        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={profile.name || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, name: event.target.value }))
          }
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={profile.email || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, email: event.target.value }))
          }
        />

        {restrictions.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Loading...
          </p>
        ) : (
          <div className="preference-grid">
            {restrictions.map((r) => (
              <button
                key={r.restriction_id}
                type="button"
                className={`toggle-tile ${
                  profile.dietary[r.dietary_restriction_name] ? "on" : ""
                }`}
                onClick={() => updateDietary(r.dietary_restriction_name)}
              >
                {r.dietary_restriction_name.charAt(0).toUpperCase() +
                  r.dietary_restriction_name.slice(1)}
              </button>
            ))}
          </div>
        )}

        <textarea
          placeholder="Notes"
          value={profile.notes || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </section>

      <button
        className="save-btn"
        type="button"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? "Saving profile..." : "Save Profile"}
      </button>
    </>
  );
}
