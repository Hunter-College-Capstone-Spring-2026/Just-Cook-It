import { useEffect, useMemo, useState } from "react";

import { ConfettiBurst } from "../components/AppEffects";
import { API_BASE_URL } from "../lib/appConfig";
import {
  buildGuideSteps,
  formatIngredientForUnits,
  mergeIngredientLists,
  sendBrowserNotification,
} from "../lib/appHelpers";

export default function RecipeDetailsPage({
  recipe,
  userId,
  settings,
  onBack,
  onCookedRecipe,
  onCooked,
  savedRecipeIds,
  onToggleSaved,
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cookError, setCookError] = useState("");
  const [cooking, setCooking] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [guideMode, setGuideMode] = useState(false);
  const [activeGuideStep, setActiveGuideStep] = useState(0);
  const [completedGuideSteps, setCompletedGuideSteps] = useState([]);
  const guideSteps = useMemo(() => buildGuideSteps(details), [details]);
  const currentGuideStep = guideSteps[activeGuideStep] || null;
  const guideProgress = guideSteps.length
    ? Math.round(((activeGuideStep + 1) / guideSteps.length) * 100)
    : 0;

  useEffect(() => {
    let cancelled = false;

    const loadRecipeDetails = async () => {
      setLoading(true);
      setCookError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/recipes/api/spoonacular/recipes/${recipe.id}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.detail || "Could not load recipe details.");
        }

        if (!cancelled) {
          setDetails(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setCookError(error.message || "Could not load recipe details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRecipeDetails();

    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  useEffect(() => {
    setGuideMode(false);
    setActiveGuideStep(0);
    setCompletedGuideSteps([]);
  }, [recipe.id]);

  useEffect(() => {
    if (!settings.autoStartGuide || guideSteps.length === 0) return;

    setGuideMode(true);
    setActiveGuideStep(0);
    setCompletedGuideSteps([]);
  }, [guideSteps.length, recipe.id, settings.autoStartGuide]);

  useEffect(() => {
    if (!celebrate) return undefined;
    const timeoutId = window.setTimeout(() => setCelebrate(false), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [celebrate]);

  const toggleSavedRecipe = () => {
    onToggleSaved(details || recipe);
  };

  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 660;
      gainNode.gain.value = 0.05;
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.frequency.exponentialRampToValueAtTime(
        990,
        ctx.currentTime + 0.22,
      );
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      oscillator.stop(ctx.currentTime + 0.24);
    } catch {
      // no-op
    }
  };

  const startGuide = () => {
    setGuideMode(true);
    setActiveGuideStep(0);
    setCompletedGuideSteps([]);
  };

  const resetGuide = () => {
    setGuideMode(false);
    setActiveGuideStep(0);
    setCompletedGuideSteps([]);
  };

  const goToGuideStep = (index) => {
    setGuideMode(true);
    setActiveGuideStep(index);
  };

  const completeCurrentGuideStep = () => {
    setCompletedGuideSteps((current) =>
      current.includes(activeGuideStep)
        ? current
        : [...current, activeGuideStep].sort((left, right) => left - right),
    );

    if (activeGuideStep < guideSteps.length - 1) {
      setActiveGuideStep((current) => current + 1);
    }
  };

  const markAsCooked = async () => {
    const source = details || recipe;
    const ingredientNames = Array.from(
      new Set(
        (source.extendedIngredients || [])
          .map((item) => item?.name || item?.originalName || item?.original)
          .filter(Boolean)
          .map((item) => item.trim()),
      ),
    );

    if (ingredientNames.length === 0) {
      setCookError("No ingredients were found for this recipe.");
      return;
    }

    setCooking(true);
    setCookError("");

    const cookedAt = new Date().toISOString();

    try {
      const response = await fetch(`${API_BASE_URL}/api/pantry/cook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ingredients: ingredientNames.map((name) => ({ name })),
          recipe: {
            recipeId: source.id || recipe.id,
            title: source.title || recipe.title,
            image: source.image || recipe.imageUrl || "",
            readyInMinutes: source.readyInMinutes || recipe.readyTime || null,
            cuisines: source.cuisines || [],
            dishTypes: source.dishTypes || [],
            cookedAt,
          },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || "Could not mark recipe as cooked.");
      }

      const cookedRecipe = {
        recipeId: source.id || recipe.id,
        title: source.title || recipe.title,
        image: source.image || recipe.imageUrl || "",
        readyInMinutes: source.readyInMinutes || recipe.readyTime || null,
        cuisines: source.cuisines || [],
        dishTypes: source.dishTypes || [],
        ingredients: ingredientNames,
        cookedAt,
      };

      onCookedRecipe?.(cookedRecipe);
      setCelebrate(true);
      playSuccessChime();
      if (settings.notifications) {
        sendBrowserNotification("Recipe marked as cooked", {
          body: `${source.title || recipe.title} was added to your cooked history.`,
        });
      }
      onCooked?.({
        pantryItems: mergeIngredientLists(
          Array.isArray(payload.ingredients) ? payload.ingredients : [],
          ingredientNames,
        ),
        recentlyAdded: ingredientNames,
        recipeTitle: source.title || recipe.title,
      });
    } catch (error) {
      setCookError(error.message || "Could not mark recipe as cooked.");
    } finally {
      setCooking(false);
    }
  };

  return (
    <section className="card gradient-card profile-card">
      {celebrate ? <ConfettiBurst /> : null}

      <div
        className="recipe-details-top"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background:
            "linear-gradient(135deg, rgba(255, 248, 242, 0.98), rgba(255, 243, 233, 0.98))",
          paddingBottom: "0.75rem",
          marginBottom: "1rem",
          borderBottom: "1px solid rgba(214, 111, 75, 0.16)",
        }}
      >
        <button
          type="button"
          className="nav-btn"
          onClick={onBack}
          style={{
            width: "auto",
            margin: 0,
            padding: "0.5rem 1rem",
            background: "linear-gradient(135deg, #ffbe95, #ff9d6f)",
            color: "#4b2213",
            border: "1px solid rgba(214, 111, 75, 0.22)",
          }}
        >
          ← Back to results
        </button>

        <button
          type="button"
          className={`save-icon-btn ${
            savedRecipeIds.includes(recipe.id) ? "saved" : ""
          }`}
          onClick={toggleSavedRecipe}
          aria-label={
            savedRecipeIds.includes(recipe.id) ? "Unsave recipe" : "Save recipe"
          }
          title={
            savedRecipeIds.includes(recipe.id) ? "Unsave recipe" : "Save recipe"
          }
        >
          {savedRecipeIds.includes(recipe.id) ? "♥" : "♡"}
        </button>
      </div>

      {loading ? <p className="sync-line">Loading recipe details...</p> : null}
      {cookError ? <p className="error-text">{cookError}</p> : null}

      {!loading && details ? (
        <>
          <h2 className="section-title">{details.title}</h2>

          {details.image ? (
            <img
              src={details.image}
              alt={details.title}
              className="recipe-details-image"
            />
          ) : null}

          <p className="recipe-meta">⏱ {details.readyInMinutes ?? "?"} min</p>

          <h3>Ingredients</h3>
          <p className="sync-line">
            Showing {settings.units === "imperial" ? "imperial" : "metric"}{" "}
            measurements.
          </p>
          <ul className="recipe-detail-list">
            {(details.extendedIngredients || []).map((ingredient, index) => (
              <li key={ingredient.id ?? `${ingredient.name}-${index}`}>
                {formatIngredientForUnits(ingredient, settings.units)}
              </li>
            ))}
          </ul>

          <section className="guide-shell" aria-labelledby="cook-guide-heading">
            <div className="guide-header">
              <div>
                <p className="guide-kicker">Cook guide</p>
                <h3 id="cook-guide-heading">Cook one step at a time</h3>
                <p className="sync-line">
                  {guideSteps.length > 0
                    ? `Guide mode split this recipe into ${guideSteps.length} focused steps.`
                    : "This recipe does not have enough structured instructions for guide mode yet."}
                </p>
              </div>

              {guideSteps.length > 0 ? (
                <button
                  type="button"
                  className={`nav-btn ${guideMode ? "active" : ""}`}
                  onClick={guideMode ? resetGuide : startGuide}
                >
                  {guideMode ? "Reset guide" : "Start guided cooking"}
                </button>
              ) : null}
            </div>

            {guideSteps.length > 0 ? (
              <>
                {guideMode ? (
                  <>
                    <div className="guide-progress-row">
                      <span>
                        Step {activeGuideStep + 1} of {guideSteps.length}
                      </span>
                      <span>{guideProgress}% through the guide</span>
                    </div>

                    <div className="guide-progress-track" aria-hidden="true">
                      <span style={{ width: `${guideProgress}%` }} />
                    </div>

                    {currentGuideStep ? (
                      <div className="guide-stage-card">
                        <span className="guide-step-badge">Now cooking</span>
                        <p className="guide-current-step">
                          {currentGuideStep.text}
                        </p>

                        {currentGuideStep.duration ? (
                          <p className="guide-meta-line">
                            Time: {currentGuideStep.duration}
                          </p>
                        ) : null}

                        {currentGuideStep.ingredients.length > 0 ? (
                          <p className="guide-meta-line">
                            Use: {currentGuideStep.ingredients.join(", ")}
                          </p>
                        ) : null}

                        {currentGuideStep.equipment.length > 0 ? (
                          <p className="guide-meta-line">
                            Tools: {currentGuideStep.equipment.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="guide-actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          setActiveGuideStep((current) =>
                            Math.max(current - 1, 0),
                          )
                        }
                        disabled={activeGuideStep === 0}
                      >
                        Previous
                      </button>

                      <button
                        type="button"
                        className="plan-btn"
                        onClick={completeCurrentGuideStep}
                      >
                        {activeGuideStep === guideSteps.length - 1
                          ? "Finish cooking steps"
                          : "Done, next step"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="guide-preview-card">
                    <p className="guide-preview-label">First step preview</p>
                    <p className="guide-preview-text">{guideSteps[0].text}</p>
                  </div>
                )}

                <ol className="guide-step-list">
                  {guideSteps.map((step, index) => {
                    const isActive = guideMode && index === activeGuideStep;
                    const isComplete = completedGuideSteps.includes(index);

                    return (
                      <li
                        key={`${step.number}-${step.text}`}
                        className={`guide-step-item ${
                          isActive ? "active" : ""
                        } ${isComplete ? "complete" : ""}`}
                      >
                        <button
                          type="button"
                          className="guide-step-btn"
                          onClick={() => goToGuideStep(index)}
                          aria-current={isActive ? "step" : undefined}
                        >
                          <span className="guide-step-index">
                            {step.number}
                          </span>
                          <span className="guide-step-copy">{step.text}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <p className="sync-line">
                You can still follow the full instructions below and save the
                ingredients to pantry after you finish.
              </p>
            )}
          </section>

          <h3>Instructions</h3>
          {details.instructions ? (
            <div
              className="recipe-instructions"
              dangerouslySetInnerHTML={{ __html: details.instructions }}
            />
          ) : (
            <p className="sync-line">
              No instructions available for this recipe.
            </p>
          )}

          <button
            type="button"
            className="plan-btn"
            onClick={markAsCooked}
            disabled={cooking}
          >
            {cooking ? "Saving to pantry..." : "Mark as cooked"}
          </button>
        </>
      ) : null}
    </section>
  );
}
