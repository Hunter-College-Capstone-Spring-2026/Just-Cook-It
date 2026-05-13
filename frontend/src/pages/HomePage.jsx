import { useEffect, useMemo, useState } from "react";

import CookingPanIcon from "../components/CookingPanIcon";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { API_BASE_URL } from "../lib/appConfig";
import {
  formatRequestError,
  mergeIngredientLists,
  sendBrowserNotification,
} from "../lib/appHelpers";

export default function HomePage({
  settings,
  userId,
  authUser,
  profile,
  onOpenRecipe,
  savedRecipeIds,
  onToggleSaved,
}) {
  const [inputValue, setInputValue] = useState("");
  const [manualIngredients, setManualIngredients] = useState([]);
  const [queryText, setQueryText] = useState("");
  const [maxTimeMinutes, setMaxTimeMinutes] = useState("");
  const [rankingMode, setRankingMode] = useState("missing");
  const [addSearchedToPantry, setAddSearchedToPantry] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [showInteraction, setShowInteraction] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [dailySuggestion, setDailySuggestion] = useState(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [, setPantryItems] = useLocalStorage(
    `jci_pantry_${userId || "guest"}`,
    [],
  );
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queuedPantryAdds, setQueuedPantryAdds] = useLocalStorage(
    "jci_queued_pantry_adds",
    [],
  );

  const profileName = typeof profile?.name === "string" ? profile.name.trim() : "";
  const authDisplayName =
    typeof authUser?.displayName === "string"
      ? authUser.displayName.trim()
      : typeof authUser?.name === "string"
        ? authUser.name.trim()
        : "";
  const email =
    (typeof profile?.email === "string" ? profile.email : "") ||
    (typeof authUser?.email === "string" ? authUser.email : "");
  const emailUsername = useMemo(() => {
    const trimmedEmail = String(email || "").trim();
    const atIndex = trimmedEmail.indexOf("@");
    return atIndex > 0 ? trimmedEmail.slice(0, atIndex) : "";
  }, [email]);

  const resolvedName = profileName || authDisplayName || emailUsername;
  const welcomeText = resolvedName ? `Welcome, ${resolvedName}` : "Welcome!";
  const characters = useMemo(() => welcomeText.split(""), [welcomeText]);
  const resultCount = settings.quickRecipes ? 5 : 10;
  const ignorePantry = true;
  const suggestionCacheKey = `jci_daily_suggestion_${userId || "guest"}`;
  const suggestionNotificationKey = `jci_daily_suggestion_notice_${userId || "guest"}`;

  const toDayKey = () =>
    new Date().toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const mapRecipeFromApi = (recipe) => ({
    id: recipe.recipeId,
    title: recipe.recipeName,
    imageUrl: recipe.recipeImageUrl,
    readyTime: recipe.readyInMinutes,
    usedIngredientCount: recipe.usedIngredientCount,
    missedIngredientCount: recipe.missedIngredientCount,
    missedIngredients: recipe.missedIngredients || [],
    usedIngredients: recipe.usedIngredients || [],
    allIngredients: recipe.allIngredients || [],
  });

  useEffect(() => {
    setVisibleChars(0);
    setShowInteraction(false);
    const startDelay = 400;
    const charDelay = 110;
    let revealTimer;
    const startTimer = setTimeout(() => {
      let count = 0;
      revealTimer = setInterval(() => {
        count += 1;
        setVisibleChars(count);
        if (count >= characters.length) {
          clearInterval(revealTimer);
          setTimeout(() => setShowInteraction(true), 200);
        }
      }, charDelay);
    }, startDelay);
    return () => {
      clearTimeout(startTimer);
      if (revealTimer) clearInterval(revealTimer);
    };
  }, [welcomeText, characters.length]);

  useEffect(() => {
    let cancelled = false;
    const loadPantry = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/pantry/?userId=${encodeURIComponent(userId)}`,
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && Array.isArray(payload.ingredients)) {
          setPantryItems((current) =>
            mergeIngredientLists(current, payload.ingredients),
          );
        }
      } catch {
        // ignore
      }
    };
    loadPantry();
    return () => {
      cancelled = true;
    };
  }, [userId, setPantryItems]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const onShortcut = (event) => {
      if (event.key === "/" && document.activeElement?.id !== "userInput") {
        event.preventDefault();
        document.getElementById("userInput")?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        searchRecipes();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  });

  useEffect(() => {
    if (!online || queuedPantryAdds.length === 0) return;
    let cancelled = false;
    const flushQueue = async () => {
      const remaining = [];
      for (const batch of queuedPantryAdds) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/pantry/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
          if (!response.ok) {
            remaining.push(batch);
          } else {
            const payload = await response.json();
            if (!cancelled && Array.isArray(payload.ingredients)) {
              setPantryItems((current) =>
                mergeIngredientLists(current, payload.ingredients),
              );
            }
          }
        } catch {
          remaining.push(batch);
        }
      }
      if (!cancelled) setQueuedPantryAdds(remaining);
    };
    flushQueue();
    return () => {
      cancelled = true;
    };
  }, [online, queuedPantryAdds, setQueuedPantryAdds, setPantryItems]);

  useEffect(() => {
    if (!online) return undefined;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/pantry/?userId=${encodeURIComponent(userId)}`,
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (Array.isArray(payload.ingredients)) {
          setPantryItems((current) =>
            mergeIngredientLists(current, payload.ingredients),
          );
        }
      } catch {
        // ignore
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [online, userId, setPantryItems]);

  const loadDailySuggestion = async ({ forceRefresh = false } = {}) => {
    if (!userId) {
      setDailySuggestion(null);
      setSuggestionError("");
      setSuggestionLoading(false);
      return;
    }

    const today = toDayKey();
    let cachedCurrentIndex = 0;
    if (!forceRefresh) {
      try {
        const cachedRaw = window.localStorage.getItem(suggestionCacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (
            cached?.date === today &&
            Object.prototype.hasOwnProperty.call(cached, "suggestion")
          ) {
            setDailySuggestion(cached.suggestion || null);
            setSuggestionIndex(
              Number.isFinite(Number(cached?.currentIndex))
                ? Number(cached.currentIndex)
                : 0,
            );
            setSuggestionError("");
            return;
          }
        }
      } catch {
        // ignore cache parse failures
      }
    }

    setSuggestionLoading(true);
    setSuggestionError("");

    try {
      if (forceRefresh) {
        cachedCurrentIndex = suggestionIndex;
      } else {
        try {
          const cachedRaw = window.localStorage.getItem(suggestionCacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            cachedCurrentIndex = Number.isFinite(Number(cached?.currentIndex))
              ? Number(cached.currentIndex)
              : 0;
          }
        } catch {
          cachedCurrentIndex = 0;
        }
      }

      const query = new URLSearchParams({ userId });
      const nextIndex = forceRefresh ? cachedCurrentIndex + 1 : 0;
      if (forceRefresh) {
        query.set("suggestionIndex", String(nextIndex));
      }
      if (forceRefresh && dailySuggestion?.id) {
        query.set("excludeRecipeId", String(dailySuggestion.id));
      }
      const response = await fetch(
        `${API_BASE_URL}/recipes/suggestion?${query.toString()}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ||
            payload?.detail ||
            "Could not load your daily suggestion.",
        );
      }

      const mappedSuggestion = payload?.suggestion
        ? mapRecipeFromApi(payload.suggestion)
        : null;
      setDailySuggestion(mappedSuggestion);
      setSuggestionIndex(nextIndex);

      window.localStorage.setItem(
        suggestionCacheKey,
        JSON.stringify({
          date: today,
          suggestion: mappedSuggestion,
          currentIndex: nextIndex,
        }),
      );
    } catch (requestError) {
      setSuggestionError(
        formatRequestError(
          requestError,
          "Could not load your daily suggestion right now.",
        ),
      );
      setDailySuggestion(null);
      if (!forceRefresh) {
        setSuggestionIndex(0);
      }
    } finally {
      setSuggestionLoading(false);
    }
  };

  useEffect(() => {
    loadDailySuggestion();
  }, [userId]);

  useEffect(() => {
    if (
      !settings.notifications ||
      !dailySuggestion ||
      suggestionLoading
    ) {
      return;
    }

    const today = toDayKey();

    try {
      const cachedRaw = window.localStorage.getItem(suggestionNotificationKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.date === today && cached?.recipeId === dailySuggestion.id) {
          return;
        }
      }
    } catch {
      // Ignore cache parsing issues and continue.
    }

    const wasSent = sendBrowserNotification("Today's Just Cook It pick", {
      body: `${dailySuggestion.title} is ready to cook.`,
      closeAfterMs: 5000,
    });

    if (!wasSent) return;

    window.localStorage.setItem(
      suggestionNotificationKey,
      JSON.stringify({
        date: today,
        recipeId: dailySuggestion.id,
      }),
    );
  }, [
    dailySuggestion,
    settings.notifications,
    suggestionLoading,
    suggestionNotificationKey,
  ]);

  const parseIngredientDraft = (value) =>
    value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const buildSearchIngredients = () => {
    const draftIngredients = parseIngredientDraft(inputValue);
    return mergeIngredientLists(manualIngredients, draftIngredients);
  };

  const hasIngredientDrivenSearch = buildSearchIngredients().length > 0;

  const renderRecipeMatchSummary = (recipe) => {
    const totalConsidered =
      (recipe.usedIngredientCount || 0) + (recipe.missedIngredientCount || 0);

    if (!hasIngredientDrivenSearch) {
      return (
        <p className="ingredient-summary">
          <strong>Ingredients </strong>
          {"("}
          {recipe.allIngredients.length || 0}
          {recipe.allIngredients.length
            ? `): ${recipe.allIngredients.join(", ")}`
            : ""}
        </p>
      );
    }

    if (rankingMode === "used") {
      return (
        <p className="ingredient-summary">
          <strong>
            Using {recipe.usedIngredientCount} out of {totalConsidered}{" "}
            ingredients:
          </strong>{" "}
          {recipe.usedIngredients.length
            ? recipe.usedIngredients.join(", ")
            : "None"}
        </p>
      );
    }

    return (
      <p className="ingredient-summary">
        <strong>
          Missing {recipe.missedIngredientCount} out of {totalConsidered}{" "}
          ingredients:
        </strong>{" "}
        {recipe.missedIngredients.length
          ? recipe.missedIngredients.join(", ")
          : "None"}
      </p>
    );
  };

  const searchRecipes = async () => {
    const draftIngredients = parseIngredientDraft(inputValue);
    const ingredientList = buildSearchIngredients();
    const ingredients = ingredientList.join(",");
    const trimmedQuery = queryText.trim();

    if (!trimmedQuery && ingredientList.length === 0) {
      setError("Enter ingredients or describe what you want to eat.");
      setRecipes([]);
      return;
    }

    setError("");
    setApiError("");
    if (draftIngredients.length > 0) {
      setManualIngredients((current) =>
        mergeIngredientLists(current, draftIngredients),
      );
      setInputValue("");
    }
    setLoading(true);

    try {
      const query = new URLSearchParams({
        userId,
        number: String(resultCount),
        ranking: rankingMode === "used" ? "1" : "2",
        ignorePantry: String(ignorePantry),
        manualOnly: "true",
      });

      if (ingredients) {
        query.set("ingredients", ingredients);
      }

      if (trimmedQuery) {
        query.set("query", trimmedQuery);
      }

      const parsedMaxTime = Number(maxTimeMinutes);
      if (Number.isFinite(parsedMaxTime) && parsedMaxTime > 0) {
        query.set("maxTime", String(Math.min(parsedMaxTime, 300)));
      }

      const response = await fetch(
        `${API_BASE_URL}/recipes/search?${query.toString()}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ||
            payload?.detail ||
            "Unable to fetch recipe ideas right now.",
        );
      }

      const mappedRecipes = (payload.results || []).map(mapRecipeFromApi);

      setRecipes(mappedRecipes);

      if (addSearchedToPantry && ingredientList.length > 0) {
        const pantryPayload = {
          user_id: userId,
          ingredients: ingredientList.map((name) => ({ name })),
        };
        if (!online) {
          setQueuedPantryAdds((current) => [...current, pantryPayload]);
        } else {
          try {
            const pantryResponse = await fetch(`${API_BASE_URL}/api/pantry/add`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pantryPayload),
            });
            const pantryData = await pantryResponse.json();
            if (pantryResponse.ok && Array.isArray(pantryData.ingredients)) {
              setPantryItems((current) =>
                mergeIngredientLists(current, pantryData.ingredients),
              );
            }
          } catch {
            setQueuedPantryAdds((current) => [...current, pantryPayload]);
          }
        }
      }
    } catch (requestError) {
      setApiError(
        formatRequestError(requestError, "Could not connect to backend API."),
      );
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const addIngredients = (rawValue = inputValue) => {
    const nextItems = parseIngredientDraft(rawValue);
    if (nextItems.length === 0) return;

    setManualIngredients((current) => mergeIngredientLists(current, nextItems));
    setInputValue("");
    setError("");
  };

  const removeManualIngredient = (ingredientName) => {
    setManualIngredients((current) =>
      current.filter(
        (item) => item.toLowerCase() !== ingredientName.toLowerCase(),
      ),
    );
  };

  const applyIngredientSuggestion = (value) => {
    setManualIngredients((current) => mergeIngredientLists(current, [value]));
    setError("");
  };

  const clearInputs = () => {
    setInputValue("");
    setManualIngredients([]);
    setQueryText("");
    setMaxTimeMinutes("");
    setError("");
    setApiError("");
  };

  const jumpToGenerator = () => {
    setShowInteraction(true);

    window.setTimeout(() => {
      document.getElementById("interaction")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      window.setTimeout(() => {
        document.getElementById("userInput")?.focus();
      }, 220);
    }, 80);
  };

  const quickSets = [
    "rice",
    "eggs",
    "chicken",
    "onion",
    "tomato",
    "spinach",
    "beans",
  ];

  return (
    <>
      <section className="home-hero-card card gradient-card">
        <div className="home-hero-copy">
          <h2
            id="welcome"
            className="welcome-text welcome-text-home"
            aria-label="Welcome"
          >
            {characters.slice(0, visibleChars).map((char, index) => (
              <span
                key={`${char}-${index}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </h2>
          <p className="home-hero-title">
            Cooking, without the extra steps!
          </p>
          <p className="search-subtitle home-search-subtitle">
            Glance at your daily suggested recipes for effortless inspiration, <br></br><br></br>or search recipes manually for a more controlled experience.
          </p>

          <div className="home-hero-actions">
            <button
              type="button"
              className="plan-btn home-hero-cta"
              onClick={jumpToGenerator}
            >
              Search Recipes
            </button>
          </div>

        </div>

        <div className="home-hero-art" aria-hidden="true">
          <div className="home-hero-art-glow" />
          <CookingPanIcon className="home-pan-icon" />
        </div>
      </section>

      <section className="card gradient-card daily-suggestion-panel">
        <div className="daily-suggestion-head">
          <div>
            <p className="home-kicker">Daily suggested recipe</p>
            <p className="search-subtitle">
              Personalized from your pantry and profile preferences.
            </p>
          </div>
          <button
            type="button"
            className="clear-btn"
            onClick={() => loadDailySuggestion({ forceRefresh: true })}
            disabled={suggestionLoading}
          >
            {suggestionLoading ? "Generating..." : "Generate new suggestion"}
          </button>
        </div>

        {suggestionError ? <p className="error-text">{suggestionError}</p> : null}

        {!suggestionLoading && !dailySuggestion && !suggestionError ? (
          <p className="sync-line">No suggestion available right now.</p>
        ) : null}

        {dailySuggestion ? (
          <ul className="recipe-list">
            <li className="recipe-card gradient-card recipe-card-layout">
              <div className="recipe-result-image-wrap">
                {dailySuggestion.imageUrl ? (
                  <img
                    src={dailySuggestion.imageUrl}
                    alt={dailySuggestion.title}
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
                      savedRecipeIds.includes(dailySuggestion.id) ? "saved" : ""
                    }`}
                    onClick={() => onToggleSaved(dailySuggestion)}
                    aria-label={
                      savedRecipeIds.includes(dailySuggestion.id)
                        ? "Unsave recipe"
                        : "Save recipe"
                    }
                    title={
                      savedRecipeIds.includes(dailySuggestion.id)
                        ? "Unsave recipe"
                        : "Save recipe"
                    }
                  >
                    {savedRecipeIds.includes(dailySuggestion.id) ? "♥" : "♡"}
                  </button>
                </div>

                <p className="recipe-title">{dailySuggestion.title}</p>
                <p className="recipe-meta">
                  ⏱ {dailySuggestion.readyTime ?? "?"} min
                </p>

                <p className="ingredient-summary">
                  <strong>
                    Missing {dailySuggestion.missedIngredientCount || 0}
                  </strong>{" "}
                  ingredient(s):{" "}
                  {dailySuggestion.missedIngredients?.length
                    ? dailySuggestion.missedIngredients.join(", ")
                    : "None"}
                </p>

                <button
                  type="button"
                  className="plan-btn"
                  onClick={() => onOpenRecipe(dailySuggestion)}
                >
                  Check it out!
                </button>
              </div>
            </li>
          </ul>
        ) : null}
      </section>

      <section
        id="interaction"
        aria-live="polite"
        className={showInteraction ? "show" : ""}
      >
        <section
          className="initial-search-panel gradient-card"
          aria-label="Search by ingredients or query"
        >
          <h3 className="initial-search-title">Manual Seach</h3>
          <p className="search-subtitle">Add ingredients or describe the meal you want</p>

          {!online ? (
            <p className="sync-line">
              Offline mode: searches may fail, saved updates will queue.
            </p>
          ) : null}

          {queuedPantryAdds.length > 0 ? (
            <p className="sync-line">
              Queued updates: {queuedPantryAdds.length}
            </p>
          ) : null}

          <div className="search-fields">
            <label htmlFor="userInput">Ingredients</label>
            <div className="ingredient-input-row">
              <input
                type="text"
                id="userInput"
                placeholder="Type each ingredient and press Enter"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addIngredients();
                  }
                  if (event.key === "Backspace" && !inputValue.trim()) {
                    setManualIngredients((current) => current.slice(0, -1));
                  }
                }}
              />
              <button
                type="button"
                className="clear-btn"
                onClick={clearInputs}
                disabled={
                  !inputValue.trim() &&
                  manualIngredients.length === 0 &&
                  !queryText.trim()
                }
              >
                Reset
              </button>
            </div>

            {manualIngredients.length > 0 ? (
              <div className="selected-ingredients">
                {manualIngredients.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="selected-ingredient-chip"
                    onClick={() => removeManualIngredient(item)}
                    aria-label={`Remove ${item}`}
                  >
                    <span>{item}</span>
                    <span className="selected-ingredient-close">×</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="field-hint">Click common ingredients below to add them to your search:</p>
            )}

            <div
              className="quick-ingredients quick-ingredients-inline"
              aria-label="Quick ingredient suggestions"
            >
              {quickSets.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip-btn"
                  onClick={() => applyIngredientSuggestion(item)}
                >
                  + {item}
                </button>
              ))}
            </div>

            <label htmlFor="queryInput">Describe the meal</label>
            <input
              type="text"
              id="queryInput"
              placeholder="Something cozy, spicy, quick, or weeknight-friendly"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") searchRecipes();
              }}
            />

            <label htmlFor="maxTimeInput">Preferred cook time (maximum)</label>
            <div className="time-input-row">
              <input
                type="text"
                id="maxTimeInput"
                className="time-input-compact"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Optional, e.g. 30"
                value={maxTimeMinutes}
                onChange={(event) =>
                  setMaxTimeMinutes(event.target.value.replace(/\D/g, "").slice(0, 3))
                }
                onBlur={() => {
                  if (!maxTimeMinutes) return;
                  const boundedMinutes = Math.min(
                    Math.max(Number(maxTimeMinutes), 1),
                    300,
                  );
                  setMaxTimeMinutes(String(boundedMinutes));
                }}
                aria-describedby="maxTimeHint"
              />
              <span className="time-input-unit">minutes</span>
            </div>

            <label>Rank results by</label>
            <div
              className="ranking-pill-group"
              role="group"
              aria-label="Rank results by"
            >
              <button
                type="button"
                className={`ranking-pill ${
                  rankingMode === "missing" ? "active" : ""
                }`}
                onClick={() => setRankingMode("missing")}
              >
                Least ingredients missing
              </button>
              <button
                type="button"
                className={`ranking-pill ${
                  rankingMode === "used" ? "active" : ""
                }`}
                onClick={() => setRankingMode("used")}
              >
                Most ingredients used
              </button>
            </div>

            <div className="setting-row search-setting-row">
              <div className="setting-copy">
                <h4>Add searched ingredients to pantry</h4>
                <p>When enabled, searching also adds current search ingredients to pantry.</p>
              </div>
              <div className="setting-actions">
                <button
                  type="button"
                  className={`toggle-switch ${addSearchedToPantry ? "on" : ""}`}
                  onClick={() => setAddSearchedToPantry((current) => !current)}
                >
                  {addSearchedToPantry ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>

          <div className="search-actions search-actions-right">
            <button
              className="search-action-btn"
              id="actionBtn"
              type="button"
              onClick={searchRecipes}
              disabled={loading}
            >
              {loading ? "Finding recipes..." : "Find recipes"}
            </button>
          </div>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {apiError ? <p className="error-text">{apiError}</p> : null}

        <section className="results" aria-live="polite">
          <h4>Recipe ideas</h4>

          {loading ? (
            <ul className="recipe-list">
              {[0, 1, 2].map((skeleton) => (
                <li
                  key={skeleton}
                  className="recipe-card gradient-card skeleton-card"
                  aria-hidden="true"
                >
                  <div className="skeleton-line short" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                </li>
              ))}
            </ul>
          ) : null}

          {!loading && recipes.length === 0 && !error && !apiError ? (
            <p id="output">Your search results will appear here.</p>
          ) : null}

          <ul className="recipe-list">
            {recipes.map((recipe) => (
              <li
                key={recipe.id}
                className="recipe-card gradient-card recipe-card-layout"
              >
                <div className="recipe-result-image-wrap">
                  {recipe.imageUrl ? (
                    <img
                      src={recipe.imageUrl}
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
                        savedRecipeIds.includes(recipe.id) ? "saved" : ""
                      }`}
                      onClick={() => onToggleSaved(recipe)}
                      aria-label={
                        savedRecipeIds.includes(recipe.id)
                          ? "Unsave recipe"
                          : "Save recipe"
                      }
                      title={
                        savedRecipeIds.includes(recipe.id)
                          ? "Unsave recipe"
                          : "Save recipe"
                      }
                    >
                      {savedRecipeIds.includes(recipe.id) ? "♥" : "♡"}
                    </button>
                  </div>

                  <p className="recipe-title">{recipe.title}</p>

                  <p className="recipe-meta">⏱ {recipe.readyTime ?? "?"} min</p>

                  {renderRecipeMatchSummary(recipe)}

                  <button
                    type="button"
                    className="plan-btn"
                    onClick={() => onOpenRecipe(recipe)}
                  >
                    Cook it
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </>
  );
}
