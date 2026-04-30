import { useEffect, useState } from "react";

import { CursorAura } from "./components/AppEffects";
import CookingPanIcon from "./components/CookingPanIcon";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { API_BASE_URL, defaultProfile, defaultSettings } from "./lib/appConfig";
import {
  mergeCookedRecipes,
  mergeProfile,
  mergeSavedRecipes,
  normalizeCookedRecipe,
  normalizeSavedRecipe,
} from "./lib/appHelpers";
import { SignInPage, SignUpPage } from "./pages/AuthPages";
import FavoritesPage from "./pages/FavoritesPage";
import HomePage from "./pages/HomePage";
import PantryPage from "./pages/PantryPage";
import ProfilePage from "./pages/ProfilePage";
import RecipeDetailsPage from "./pages/RecipeDetailsPage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  const [authUser, setAuthUser] = useLocalStorage("jci_auth_user", null);
  const [activePage, setActivePage] = useState("home");
  const [appReady, setAppReady] = useState(false);
  const [profile, setProfile] = useState(defaultProfile);
  const [settings, setSettings] = useLocalStorage("jci_settings", defaultSettings);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [cookedRecipes, setCookedRecipes] = useState([]);
  const [pantryLanding, setPantryLanding] = useState({
    pantryItems: [],
    recentlyAdded: [],
    recipeTitle: "",
  });
  const [savedRecipeIds, setSavedRecipeIds] = useLocalStorage(
    `jci_saved_recipe_ids_${authUser?.userId || "guest"}`,
    [],
  );
  const [savedRecipes, setSavedRecipes] = useLocalStorage(
    `jci_saved_recipe_cards_${authUser?.userId || "guest"}`,
    [],
  );
  const [profileSyncMessage, setProfileSyncMessage] = useState("");
  const [settingsSyncMessage, setSettingsSyncMessage] = useState(
    "Settings stored locally.",
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingCookedHistory, setResettingCookedHistory] = useState(false);
  const [resettingPantry, setResettingPantry] = useState(false);

  const userId = authUser?.userId || null;
  const isLoggedIn = !!authUser;

  const navItems = isLoggedIn
    ? [
        { id: "home", label: "Home" },
        { id: "pantry", label: "Pantry" },
        { id: "favorites", label: "Favorites" },
        { id: "profile", label: "Profile" },
        { id: "settings", label: "Settings" },
      ]
    : [];

  useEffect(() => {
    if (!isLoggedIn && activePage !== "signup") {
      setActivePage("signin");
    }
  }, [activePage, isLoggedIn]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setAppReady(true);
      return undefined;
    }

    let timeoutId = 0;
    const frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => setAppReady(true), 90);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const loadRemoteState = async () => {
      try {
        const [profileResp, settingsResp, savedResp] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/users/profile?userId=${encodeURIComponent(userId)}`,
          ),
          fetch(
            `${API_BASE_URL}/api/users/settings?userId=${encodeURIComponent(userId)}`,
          ),
          fetch(`${API_BASE_URL}/recipes/saved?userId=${encodeURIComponent(userId)}`),
        ]);

        if (profileResp.ok) {
          const profilePayload = await profileResp.json();
          if (isMounted) {
            const {
              cookedRecipes: remoteCookedRecipes = [],
              ...profileFields
            } = profilePayload;
            setProfile(mergeProfile(defaultProfile, profileFields));
            if (Array.isArray(remoteCookedRecipes)) {
              setCookedRecipes(
                remoteCookedRecipes.map(normalizeCookedRecipe).filter(Boolean),
              );
            }
            setProfileSyncMessage("Profile synced.");
          }
        } else if (isMounted) {
          setProfileSyncMessage("Could not load profile.");
        }

        if (settingsResp.ok) {
          const settingsPayload = await settingsResp.json();
          if (isMounted) {
            setSettings((current) => ({
              ...defaultSettings,
              ...current,
              ...settingsPayload,
            }));
            setSettingsSyncMessage("Settings synced.");
          }
        } else if (isMounted) {
          setSettingsSyncMessage("Using saved settings locally.");
        }

        if (savedResp.ok) {
          const savedPayload = await savedResp.json();
          if (isMounted && Array.isArray(savedPayload.recipes)) {
            const nextSavedRecipes = mergeSavedRecipes([], savedPayload.recipes);
            setSavedRecipes(nextSavedRecipes);
            setSavedRecipeIds(
              nextSavedRecipes.map((recipe) => recipe.recipeId).filter(Boolean),
            );
          }
        }
      } catch {
        if (isMounted) {
          setProfileSyncMessage("Could not reach backend.");
          setSettingsSyncMessage("Using saved settings locally.");
        }
      }
    };

    loadRemoteState();
    return () => {
      isMounted = false;
    };
  }, [setSavedRecipeIds, setSavedRecipes, setSettings, userId]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...profile }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Profile save failed.");
      }
      setProfileSyncMessage(
        payload.warning
          ? `Saved with warning: ${payload.warning}`
          : "Profile saved to Supabase.",
      );
    } catch (error) {
      setProfileSyncMessage(error.message || "Profile saved locally only.");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...settings }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Settings save failed.");
      }
      setSettingsSyncMessage(
        payload.warning
          ? `Saved with warning: ${payload.warning}`
          : "Settings saved to Supabase.",
      );
    } catch (error) {
      setSettingsSyncMessage(error.message || "Settings saved locally only.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/signout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: authUser?.userId }),
      });
    } catch {
      // ignore network errors on signout
    }
    setAuthUser(null);
    setProfile(defaultProfile);
    setActivePage("signin");
    setSelectedRecipe(null);
    setPantryLanding({ pantryItems: [], recentlyAdded: "", recipeTitle: "" });
  };

  const handlePageChange = (pageId, options = {}) => {
    const { preservePantryContext = false } = options;

    setActivePage(pageId);
    setSelectedRecipe(null);

    if (pageId !== "pantry" || !preservePantryContext) {
      setPantryLanding((current) => ({
        ...current,
        recentlyAdded: [],
        recipeTitle: "",
      }));
    }
  };

  const recordCookedRecipe = (recipeEntry) => {
    const normalized = normalizeCookedRecipe(recipeEntry);
    if (!normalized) return;
    setCookedRecipes((current) => mergeCookedRecipes(current, [normalized]));
  };

  const resetCookedRecipes = async () => {
    if (!userId) return;

    const previousCookedRecipes = cookedRecipes;
    setResettingCookedHistory(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/cooked-recipes?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || "Could not clear cooked history.");
      }

      setCookedRecipes(Array.isArray(payload.recipes) ? payload.recipes : []);
      setPantryLanding((current) => ({
        ...current,
        recentlyAdded: [],
        recipeTitle: "",
      }));
      setProfileSyncMessage(
        payload.warning
          ? `Cleared with warning: ${payload.warning}`
          : "Cooked history cleared.",
      );
    } catch (error) {
      setCookedRecipes(previousCookedRecipes);
      setProfileSyncMessage(error.message || "Could not clear cooked history.");
    } finally {
      setResettingCookedHistory(false);
    }
  };

  const resetPantryItems = async () => {
    if (!userId) return [];

    const pantryStorageKey = `jci_pantry_${userId}`;
    setResettingPantry(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/pantry/?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const payload = await response.json();

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.warning || payload?.detail || "Could not clear pantry.",
        );
      }

      const nextPantryItems = Array.isArray(payload.ingredients)
        ? payload.ingredients
        : [];
      window.localStorage.setItem(
        pantryStorageKey,
        JSON.stringify(nextPantryItems),
      );
      window.localStorage.setItem("jci_queued_pantry_adds", JSON.stringify([]));
      setPantryLanding({
        pantryItems: nextPantryItems,
        recentlyAdded: [],
        recipeTitle: "",
      });
      return nextPantryItems;
    } finally {
      setResettingPantry(false);
    }
  };

  const toggleSavedRecipe = async (recipe) => {
    const recipeId = Number(recipe.id ?? recipe.recipeId);
    if (!recipeId) return;

    const previousSavedRecipeIds = savedRecipeIds;
    const previousSavedRecipes = savedRecipes;
    const wasSaved = savedRecipeIds.includes(recipeId);
    const optimisticRecipe = normalizeSavedRecipe({
      ...recipe,
      recipeId,
      title: recipe.title ?? recipe.recipeName ?? "",
      image: recipe.image ?? recipe.imageUrl ?? "",
      readyInMinutes: recipe.readyInMinutes ?? recipe.readyTime ?? null,
      cuisines: recipe.cuisines ?? [],
      dishTypes: recipe.dishTypes ?? [],
      ingredients: recipe.ingredients ?? recipe.allIngredients ?? [],
      savedAt: recipe.savedAt ?? new Date().toISOString(),
    });

    setSavedRecipeIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId],
    );
    setSavedRecipes((current) =>
      wasSaved
        ? current.filter((savedRecipe) => savedRecipe.recipeId !== recipeId)
        : mergeSavedRecipes(current, optimisticRecipe ? [optimisticRecipe] : []),
    );

    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/recipes/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          recipe: {
            recipeId,
            title: recipe.title ?? "",
            image: recipe.image ?? "",
            readyInMinutes: recipe.readyInMinutes ?? null,
            cuisines: recipe.cuisines ?? [],
            dishTypes: recipe.dishTypes ?? [],
          },
        }),
      });
      const payload = await response.json();

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.warning || payload?.detail || "Could not update favorites.",
        );
      }

      if (payload?.saved === false) {
        setSavedRecipeIds((current) =>
          current.filter((id) => id !== recipeId),
        );
        setSavedRecipes((current) =>
          current.filter((savedRecipe) => savedRecipe.recipeId !== recipeId),
        );
        return;
      }

      if (payload?.saved === true && optimisticRecipe) {
        setSavedRecipeIds((current) =>
          current.includes(recipeId) ? current : [...current, recipeId],
        );
        setSavedRecipes((current) =>
          mergeSavedRecipes(current, [optimisticRecipe]),
        );
      }
    } catch {
      setSavedRecipeIds(previousSavedRecipeIds);
      setSavedRecipes(previousSavedRecipes);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className={`app-shell ${appReady ? "is-ready" : ""}`}>
        <div className="app-calm-overlay" aria-hidden="true" />
        <CursorAura />
        <header className="navbar">
          <h1 className="logo">
            <span className="logo-mark">
              <CookingPanIcon className="logo-icon" />
            </span>
            <span>Just Cook It!</span>
          </h1>
          <nav>
            <ul className="nav-links">
              <li>
                <button
                  type="button"
                  className={`nav-btn ${activePage === "signin" ? "active" : ""}`}
                  onClick={() => setActivePage("signin")}
                >
                  Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-btn ${activePage === "signup" ? "active" : ""}`}
                  onClick={() => setActivePage("signup")}
                >
                  Sign Up
                </button>
              </li>
            </ul>
          </nav>
        </header>

        <main>
          <section key={activePage} className="page-shell" aria-live="polite">
            {activePage === "signin" && (
              <SignInPage
                onSuccess={(user) => {
                  setAuthUser(user);
                  setActivePage("home");
                }}
                onGoToSignUp={() => setActivePage("signup")}
              />
            )}
            {activePage === "signup" && (
              <SignUpPage
                onSuccess={(user) => {
                  setAuthUser(user);
                  setActivePage("home");
                }}
                onGoToSignIn={() => setActivePage("signin")}
              />
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`app-shell ${appReady ? "is-ready" : ""}`}>
      <div className="app-calm-overlay" aria-hidden="true" />
      <CursorAura />
      <header className="navbar">
        <button
          type="button"
          className="logo logo-btn"
          onClick={() => handlePageChange("home")}
          aria-label="Go to home page"
        >
          <span className="logo-mark">
            <CookingPanIcon className="logo-icon" />
          </span>
          <span>Just Cook It!</span>
        </button>
        <nav>
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`nav-btn ${
                    activePage === item.id ? "active" : ""
                  }`}
                  onClick={() => handlePageChange(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="nav-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <section className="page-shell" aria-live="polite">
          {activePage === "home" && (
            <>
              <div style={{ display: selectedRecipe ? "none" : "block" }}>
                <HomePage
                  settings={settings}
                  userId={userId}
                  onOpenRecipe={(recipe) => setSelectedRecipe(recipe)}
                  savedRecipeIds={savedRecipeIds}
                  onToggleSaved={toggleSavedRecipe}
                />
              </div>

              {selectedRecipe ? (
                <RecipeDetailsPage
                  recipe={selectedRecipe}
                  userId={userId}
                  settings={settings}
                  onBack={() => setSelectedRecipe(null)}
                  onCookedRecipe={recordCookedRecipe}
                  onCooked={({ pantryItems, recentlyAdded, recipeTitle }) => {
                    setPantryLanding({
                      pantryItems,
                      recentlyAdded,
                      recipeTitle,
                    });
                    handlePageChange("pantry", {
                      preservePantryContext: true,
                    });
                  }}
                  savedRecipeIds={savedRecipeIds}
                  onToggleSaved={toggleSavedRecipe}
                />
              ) : null}
            </>
          )}

          {activePage === "pantry" && (
            <PantryPage
              userId={userId}
              initialPantryItems={pantryLanding.pantryItems}
              recentlyAdded={pantryLanding.recentlyAdded}
              recipeTitle={pantryLanding.recipeTitle}
              lastCookedRecipe={cookedRecipes[0] || null}
              cookedRecipes={cookedRecipes}
              onGoHome={() => handlePageChange("home")}
              onResetCooked={resetCookedRecipes}
              resettingCooked={resettingCookedHistory}
              onResetPantry={resetPantryItems}
              resettingPantry={resettingPantry}
            />
          )}

          {activePage === "favorites" && (
            <>
              {!selectedRecipe ? (
                <FavoritesPage
                  savedRecipes={savedRecipes}
                  savedRecipeIds={savedRecipeIds}
                  onToggleSaved={toggleSavedRecipe}
                  onOpenRecipe={(recipe) => setSelectedRecipe(recipe)}
                  onGoHome={() => handlePageChange("home")}
                />
              ) : (
                <RecipeDetailsPage
                  recipe={selectedRecipe}
                  userId={userId}
                  settings={settings}
                  onBack={() => setSelectedRecipe(null)}
                  onCookedRecipe={recordCookedRecipe}
                  onCooked={({ pantryItems, recentlyAdded, recipeTitle }) => {
                    setPantryLanding({
                      pantryItems,
                      recentlyAdded,
                      recipeTitle,
                    });
                    handlePageChange("pantry", {
                      preservePantryContext: true,
                    });
                  }}
                  savedRecipeIds={savedRecipeIds}
                  onToggleSaved={toggleSavedRecipe}
                />
              )}
            </>
          )}

          {activePage === "profile" && (
            <ProfilePage
              userId={userId}
              profile={profile}
              setProfile={setProfile}
              settings={settings}
              cookedRecipes={cookedRecipes}
              onResetCooked={resetCookedRecipes}
              onSave={saveProfile}
              syncMessage={profileSyncMessage}
              saving={savingProfile}
              resettingCooked={resettingCookedHistory}
            />
          )}

          {activePage === "settings" && (
            <SettingsPage
              settings={settings}
              setSettings={setSettings}
              onSave={saveSettings}
              syncMessage={settingsSyncMessage}
              saving={savingSettings}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
