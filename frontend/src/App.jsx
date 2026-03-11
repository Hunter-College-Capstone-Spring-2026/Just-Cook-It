import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const defaultProfile = {
  email: "user@email.com",
  name: "Cook It User",
  dietary: {
    vegetarian: false,
    vegan: false,
    halal: false,
    glutenFree: false
  },
  notes: ""
};

const defaultSettings = {
  notifications: true,
  emailRecipeUpdates: true,
  weeklyDigestEmail: false,
  quickRecipes: true,
  defaultResultCount: 10,
  defaultMaxCookTime: 0,
  units: "metric",
  language: "en",
  theme: "light",
  publicProfile: false,
  allowUsageAnalytics: false,
  allowProgressNudges: true
};

const SUPPORTIVE_LINES = [
  "Find something fast.",
  "Start with what you have.",
  "Pick a recipe and go.",
  "Search in seconds."
];

function generateUserId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const existing = window.localStorage.getItem(key);
      return existing ? JSON.parse(existing) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function mergeProfile(base, incoming) {
  return {
    ...base,
    ...incoming,
    dietary: {
      ...base.dietary,
      ...(incoming?.dietary || {})
    }
  };
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [profile, setProfile] = useLocalStorage("jci_profile", defaultProfile);
  const [settings, setSettings] = useLocalStorage("jci_settings", defaultSettings);
  const [userId] = useLocalStorage("jci_user_id", generateUserId());

  const [profileSyncMessage, setProfileSyncMessage] = useState("Profile stored locally.");
  const [settingsSyncMessage, setSettingsSyncMessage] = useState("Settings stored locally.");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const navItems = [
    { id: "home", label: "Home" },
    { id: "profile", label: "Profile" },
    { id: "settings", label: "Settings" }
  ];

  useEffect(() => {
    let isMounted = true;

    const loadRemoteState = async () => {
      try {
        const [profileResp, settingsResp] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/profile?userId=${encodeURIComponent(userId)}`),
          fetch(`${API_BASE_URL}/api/users/settings?userId=${encodeURIComponent(userId)}`)
        ]);

        if (profileResp.ok) {
          const profilePayload = await profileResp.json();
          if (isMounted) {
            setProfile((current) => mergeProfile(current, profilePayload));
            setProfileSyncMessage("Profile synced with Supabase.");
          }
        } else if (isMounted) {
          setProfileSyncMessage("Using local profile (Supabase profile sync unavailable).");
        }

        if (settingsResp.ok) {
          const settingsPayload = await settingsResp.json();
          if (isMounted) {
            setSettings((current) => ({ ...current, ...settingsPayload }));
            setSettingsSyncMessage("Settings synced with Supabase.");
          }
        } else if (isMounted) {
          setSettingsSyncMessage("Using local settings (Supabase settings sync unavailable).");
        }
      } catch {
        if (isMounted) {
          setProfileSyncMessage("Using local profile (could not reach backend).");
          setSettingsSyncMessage("Using local settings (could not reach backend).");
        }
      }
    };

    loadRemoteState();

    return () => {
      isMounted = false;
    };
  }, [setProfile, setSettings, userId]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...profile })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Profile save failed.");
      }

      setProfileSyncMessage(payload.warning ? `Saved with warning: ${payload.warning}` : "Profile saved to Supabase.");
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
        body: JSON.stringify({ userId, ...settings })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Settings save failed.");
      }

      setSettingsSyncMessage(payload.warning ? `Saved with warning: ${payload.warning}` : "Settings saved to Supabase.");
    } catch (error) {
      setSettingsSyncMessage(error.message || "Settings saved locally only.");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <>
      <CursorAura />
      <header className="navbar">
        <h1 className="logo">Just Cook It!</h1>
        <nav>
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`nav-btn ${activePage === item.id ? "active" : ""}`}
                  onClick={() => setActivePage(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main>
        <section key={activePage} className="page-shell" aria-live="polite">
          {activePage === "home" && <HomePage settings={settings} userId={userId} profile={profile} />}
          {activePage === "profile" && (
            <ProfilePage
              profile={profile}
              setProfile={setProfile}
              onSave={saveProfile}
              syncMessage={profileSyncMessage}
              saving={savingProfile}
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

      <nav className="quick-nav" aria-label="Quick navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`quick-nav-btn ${activePage === item.id ? "active" : ""}`}
            onClick={() => setActivePage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function HomePage({ settings, userId, profile }) {
  const [inputValue, setInputValue] = useState("");
  const [maxTimeMinutes, setMaxTimeMinutes] = useState("");
  const [sortPriority, setSortPriority] = useState("missing"); // default: fewer missing ingredients
  const [ignorePantry, setIgnorePantry] = useState(true);
  const [resultCount, setResultCount] = useState(
    Number(settings.defaultResultCount || (settings.quickRecipes ? 5 : 10))
  );
  const [minUsedFilter, setMinUsedFilter] = useState("");
  const [maxMissingFilter, setMaxMissingFilter] = useState("");
  const [showNudge, setShowNudge] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [showInteraction, setShowInteraction] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [pantryItems, setPantryItems] = useState([]);
  const [pantryMessage, setPantryMessage] = useState("");
  const [pantryError, setPantryError] = useState("");
  const [savingPantry, setSavingPantry] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queuedPantryAdds, setQueuedPantryAdds] = useLocalStorage("jci_queued_pantry_adds", []);
  const [onboardingDismissed, setOnboardingDismissed] = useLocalStorage("jci_onboarding_dismissed", false);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [commitmentName, setCommitmentName] = useState("");
  const [commitmentPosted, setCommitmentPosted] = useState(false);
  const [rewardUnlockedToday, setRewardUnlockedToday] = useState(false);

  const firstName = (profile?.name || "").trim().split(" ")[0];
  const welcomeText = firstName ? `${firstName}, cook from what you have` : "Cook from what you have";
  const characters = useMemo(() => welcomeText.split(""), [welcomeText]);
  const supportiveMessage = useMemo(() => {
    const hour = new Date().getHours();
    const idx = hour % SUPPORTIVE_LINES.length;
    return SUPPORTIVE_LINES[idx];
  }, []);
  const progressStepsDone = [
    inputValue.trim().length > 0,
    recipes.length > 0,
    selectedRecipeId.length > 0
  ].filter(Boolean).length;
  const progressPercent = Math.round((progressStepsDone / 3) * 100);
  const onboardingProgress = Math.round(
    ((inputValue.trim() ? 1 : 0) + (recipes.length > 0 ? 1 : 0) + (pantryItems.length > 0 ? 1 : 0)) / 3 * 100
  );

  useEffect(() => {
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
  }, [characters.length]);

  useEffect(() => {
    if (inputValue.trim()) {
      setShowNudge(false);
      return undefined;
    }

    const nudgeTimer = setTimeout(() => setShowNudge(true), 6000);
    return () => clearTimeout(nudgeTimer);
  }, [inputValue]);

  useEffect(() => {
    let cancelled = false;

    const loadPantry = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/pantry?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) {
          setPantryItems(Array.isArray(payload.ingredients) ? payload.ingredients : []);
        }
      } catch {
        // ignore pantry preload failures; user can still search recipes
      }
    };

    loadPantry();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    window.localStorage.removeItem("jci_search_ingredients");
    window.localStorage.removeItem("jci_search_max_time");
  }, []);

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
          const response = await fetch(`${API_BASE_URL}/pantry/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
          if (!response.ok) {
            remaining.push(batch);
          } else {
            const payload = await response.json();
            if (!cancelled && Array.isArray(payload.ingredients)) {
              setPantryItems(payload.ingredients);
            }
          }
        } catch {
          remaining.push(batch);
        }
      }
      if (!cancelled) {
        setQueuedPantryAdds(remaining);
      }
    };

    flushQueue();
    return () => {
      cancelled = true;
    };
  }, [online, queuedPantryAdds, setQueuedPantryAdds]);

  useEffect(() => {
    if (!online) return undefined;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/pantry?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) return;
        const payload = await response.json();
        if (Array.isArray(payload.ingredients)) {
          setPantryItems(payload.ingredients);
        }
      } catch {
        // silently ignore live refresh failures
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [online, userId]);

  useEffect(() => {
    setResultCount(Number(settings.defaultResultCount || (settings.quickRecipes ? 5 : 10)));
  }, [settings.defaultResultCount, settings.quickRecipes]);

  const parseIngredients = () =>
    inputValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const searchRecipes = async () => {
    const ingredientList = parseIngredients();
    const ingredients = ingredientList.join(",");

    if (ingredientList.length === 0) {
      setError("Add at least one ingredient to get started.");
      setRecipes([]);
      return;
    }

    setError("");
    setApiError("");
    setLoading(true);

    try {
      const query = new URLSearchParams({
        ingredients,
        number: String(resultCount),
        ranking: sortPriority === "used" ? "1" : "2",
        ignorePantry: String(ignorePantry)
      });
      const chosenMaxTime = maxTimeMinutes || String(settings.defaultMaxCookTime || "");
      if (chosenMaxTime) {
        query.set("maxTime", chosenMaxTime);
      }
      const response = await fetch(`${API_BASE_URL}/api/spoonacular/recipes/search?${query.toString()}`);

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.detail || "Unable to fetch recipe ideas right now.");
      }

      const mappedRecipes = (payload.results || []).map((recipe) => ({
        id: recipe.recipeId,
        title: recipe.recipeName,
        imageUrl: recipe.recipeImageUrl,
        usedIngredientCount: recipe.usedIngredientCount,
        missedIngredientCount: recipe.missedIngredientCount,
        missedIngredients: recipe.missedIngredients || []
      }));
      const minUsedValue = minUsedFilter ? Number(minUsedFilter) : null;
      const maxMissingValue = maxMissingFilter ? Number(maxMissingFilter) : null;
      const filteredRecipes = mappedRecipes.filter((recipe) => {
        if (minUsedValue !== null && recipe.usedIngredientCount < minUsedValue) return false;
        if (maxMissingValue !== null && recipe.missedIngredientCount > maxMissingValue) return false;
        return true;
      });

      const sortedRecipes = filteredRecipes.sort((a, b) => {
        if (sortPriority === "used") {
          if (b.usedIngredientCount !== a.usedIngredientCount) {
            return b.usedIngredientCount - a.usedIngredientCount;
          }
          return a.missedIngredientCount - b.missedIngredientCount;
        }
        if (a.missedIngredientCount !== b.missedIngredientCount) {
          return a.missedIngredientCount - b.missedIngredientCount;
        }
        return b.usedIngredientCount - a.usedIngredientCount;
      });

      setRecipes(sortedRecipes);
      setSelectedRecipeId("");
    } catch (requestError) {
      const message = requestError?.message || "";
      if (message === "Load failed" || message === "Failed to fetch") {
        setApiError("Could not connect to backend API. Start backend on http://localhost:4000.");
      } else {
        setApiError(message || "Could not connect to backend API.");
      }
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const addToPantry = async () => {
    const ingredientList = parseIngredients();
    if (ingredientList.length === 0) {
      setPantryError("Enter one or more ingredients, separated by commas.");
      setPantryMessage("");
      return;
    }

    setSavingPantry(true);
    setPantryError("");
    setPantryMessage("");
    const previousPantry = pantryItems;
    const optimistic = Array.from(new Set([...pantryItems, ...ingredientList]));
    setPantryItems(optimistic);
    try {
      const requestBody = {
        user_id: userId,
        ingredients: ingredientList.map((name) => ({ name }))
      };
      if (!online) {
        setQueuedPantryAdds((current) => [...current, requestBody]);
        setPantryMessage("Saved offline. Pantry will sync when connection returns.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pantry/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Could not add to pantry.");
      }
      setPantryItems(Array.isArray(payload.ingredients) ? payload.ingredients : []);
      setPantryMessage(`Added ${ingredientList.length} ingredient${ingredientList.length > 1 ? "s" : ""} to pantry.`);
    } catch (requestError) {
      setPantryItems(previousPantry);
      setPantryError(requestError?.message || "Could not add to pantry.");
    } finally {
      setSavingPantry(false);
    }
  };

  const applyIngredientSuggestion = (value) => {
    setInputValue((current) => (current ? `${current}, ${value}` : value));
  };

  const clearIngredients = () => {
    setInputValue("");
  };

  const quickSets = ["rice", "eggs", "chicken", "onion", "tomato", "spinach", "beans"];

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
      oscillator.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.22);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      oscillator.stop(ctx.currentTime + 0.24);
    } catch {
      // no-op for browsers without audio context permissions
    }
  };

  const completeRecipePlan = (recipeId) => {
    setSelectedRecipeId(recipeId);
    setCelebrate(true);
    playSuccessChime();

    const today = new Date().toISOString().slice(0, 10);
    const lastRewardDate = window.localStorage.getItem("jci_reward_day");
    if (lastRewardDate !== today) {
      setRewardUnlockedToday(true);
      window.localStorage.setItem("jci_reward_day", today);
    } else {
      setRewardUnlockedToday(false);
    }

    setTimeout(() => setCelebrate(false), 1000);
  };

  const postCommitment = () => {
    if (!commitmentName.trim()) return;
    setCommitmentPosted(true);
  };

  return (
    <>
      <h2 id="welcome" className="welcome-text" aria-label="Welcome">
        {characters.slice(0, visibleChars).map((char, index) => (
          <span key={`${char}-${index}`}>{char === " " ? "\u00A0" : char}</span>
        ))}
      </h2>

      <section id="interaction" aria-live="polite" className={showInteraction ? "show" : ""}>
        {celebrate ? <ConfettiBurst /> : null}
        {!onboardingDismissed ? (
          <section className="card gradient-card onboarding-card">
            <div className="onboarding-top">
              <h4>Start here</h4>
              <button type="button" className="chip-btn" onClick={() => setOnboardingDismissed(true)}>
                Hide
              </button>
            </div>
            <p>Use what you already have. Save what you want to keep.</p>
            <div className="progress-strip" aria-label="Onboarding progress">
              <div className="progress-fill" style={{ width: `${onboardingProgress}%` }} />
            </div>
          </section>
        ) : null}
        <div className="pressure-banner">
          <p>{supportiveMessage}</p>
        </div>
        <section className="fogg-panel gradient-card">
          <h4>Your kitchen</h4>
          <p>{pantryItems.length > 0 ? `${pantryItems.length} pantry items saved.` : "Start with a few ingredients."}</p>
          <div className="progress-strip" aria-label="Task progress">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="progress-copy">{progressStepsDone}/3 done</p>
        </section>
        <section className="initial-search-panel gradient-card" aria-label="Search by ingredients">
          <h3 className="initial-search-title wave-title">
            {firstName ? `${firstName}, what's in your kitchen?` : "What's in your kitchen?"}
          </h3>
          {!online ? <p className="sync-line">Offline. Pantry will sync later.</p> : null}
          {queuedPantryAdds.length > 0 ? <p className="sync-line">Queued: {queuedPantryAdds.length}</p> : null}

          <div className="multi-filter-panel" aria-label="Search filters">
            <p className="filter-title">Filters</p>
            <div className="priority-toggle-group" role="group" aria-label="Sort priority">
              <button
                type="button"
                className={`priority-toggle ${sortPriority === "missing" ? "active" : ""}`}
                onClick={() => setSortPriority("missing")}
              >
                Fewer missing
              </button>
              <button
                type="button"
                className={`priority-toggle ${sortPriority === "used" ? "active" : ""}`}
                onClick={() => setSortPriority("used")}
              >
                More used
              </button>
            </div>

            <div className="filter-grid">
              <div>
                <label htmlFor="resultCount" className="tooltip-label">
                  Results
                  <span className="tooltip-text">How many recipes to show.</span>
                </label>
                <select
                  id="resultCount"
                  value={resultCount}
                  onChange={(event) => setResultCount(Number(event.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div>
                <label htmlFor="minUsedFilter" className="tooltip-label">
                  Min used
                  <span className="tooltip-text">Only show recipes using at least this many of your ingredients.</span>
                </label>
                <input
                  id="minUsedFilter"
                  type="number"
                  min="0"
                  max="20"
                  placeholder="Optional"
                  value={minUsedFilter}
                  onChange={(event) => setMinUsedFilter(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="maxMissingFilter" className="tooltip-label">
                  Max missing
                  <span className="tooltip-text">Hide recipes that need more missing ingredients than this.</span>
                </label>
                <input
                  id="maxMissingFilter"
                  type="number"
                  min="0"
                  max="20"
                  placeholder="Optional"
                  value={maxMissingFilter}
                  onChange={(event) => setMaxMissingFilter(event.target.value)}
                />
              </div>

              <div className="filter-toggle-block">
                <label htmlFor="ignorePantryToggle" className="tooltip-label">
                  Ignore pantry
                  <span className="tooltip-text">Treat pantry staples like oil and salt as optional.</span>
                </label>
                <button
                  id="ignorePantryToggle"
                  type="button"
                  className={`toggle-switch ${ignorePantry ? "on" : ""}`}
                  onClick={() => setIgnorePantry((current) => !current)}
                >
                  {ignorePantry ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>

          <div className="search-fields">
            <label htmlFor="userInput">Ingredients</label>
            <input
              type="text"
              id="userInput"
              placeholder="e.g. chicken, rice, spinach"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") searchRecipes();
              }}
            />

            <label htmlFor="maxTimeInput" className="tooltip-label">
              Max time
              <span className="tooltip-text">Limit recipes by total cook time in minutes.</span>
            </label>
            <input
              type="number"
              id="maxTimeInput"
              className="time-input-compact"
              min="1"
              max="300"
              placeholder="Optional, e.g. 30"
              value={maxTimeMinutes}
              onChange={(event) => setMaxTimeMinutes(event.target.value)}
            />
          </div>

          <div className="quick-ingredients" aria-label="Quick ingredient suggestions">
            {quickSets.map((item) => (
              <button key={item} type="button" className="chip-btn" onClick={() => applyIngredientSuggestion(item)}>
                + {item}
              </button>
            ))}
          </div>

          <div id="nudge" className={`nudge ${showNudge ? "show" : "hidden"}`}>
            Try one ingredient.
          </div>

          <div className="search-actions">
            <button className="search-action-btn" id="actionBtn" type="button" onClick={searchRecipes} disabled={loading}>
              {loading ? "Finding recipes..." : "Cook it!"}
            </button>
            <button
              type="button"
              className="search-action-btn"
              onClick={addToPantry}
              disabled={savingPantry}
            >
              {savingPantry ? "Adding..." : "Add to pantry"}
            </button>
            <button type="button" className="search-action-btn" onClick={clearIngredients} disabled={!inputValue.trim()}>
              Clear
            </button>
          </div>
          <p className="sync-line">`/` focus, `Cmd/Ctrl + Enter` search.</p>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {apiError ? <p className="error-text">{apiError}</p> : null}
        {pantryError ? <p className="error-text">{pantryError}</p> : null}
        {pantryMessage ? <p className="sync-line">{pantryMessage}</p> : null}
        {pantryItems.length > 0 ? (
          <p className="sync-line">Pantry: {pantryItems.join(", ")}</p>
        ) : null}

        <section className="results" aria-live="polite">
          <h4>Recipes</h4>
          {loading ? (
            <ul className="recipe-list">
              {[0, 1, 2].map((skeleton) => (
                <li key={skeleton} className="recipe-card gradient-card skeleton-card" aria-hidden="true">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                </li>
              ))}
            </ul>
          ) : null}
          {!loading && recipes.length === 0 && !error && !apiError ? (
            <p id="output">No results yet.</p>
          ) : null}

          <ul className="recipe-list">
            {recipes.map((recipe) => (
              <li
                key={recipe.id}
                className={`recipe-card gradient-card ${selectedRecipeId === recipe.id ? "selected-recipe" : ""}`}
              >
                <p className="recipe-title">{recipe.title}</p>
                <p>
                  Uses {recipe.usedIngredientCount} | Missing {recipe.missedIngredientCount}
                </p>
                <p>
                  Missing ingredients: {recipe.missedIngredients.length ? recipe.missedIngredients.join(", ") : "None"}
                </p>
                <button
                  type="button"
                  className="plan-btn"
                  title={selectedRecipeId === recipe.id ? "Selected recipe" : "Mark this recipe as your plan"}
                  onClick={() => completeRecipePlan(recipe.id)}
                >
                  {selectedRecipeId === recipe.id ? "Planned" : "Choose"}
                </button>
              </li>
            ))}
          </ul>

          {selectedRecipeId ? (
            <section className="completion-panel gradient-card" aria-live="polite">
              <h4>Chosen</h4>
              <p>You picked a recipe.</p>
              {rewardUnlockedToday ? (
                <p className="reward-line">Reward unlocked.</p>
              ) : (
                <p className="reward-line">Reward already claimed today.</p>
              )}

              <div className="commitment-box">
                <label htmlFor="commitmentName">Cooking for</label>
                <input
                  id="commitmentName"
                  type="text"
                  placeholder="name"
                  value={commitmentName}
                  onChange={(event) => {
                    setCommitmentName(event.target.value);
                    setCommitmentPosted(false);
                  }}
                />
                <button type="button" onClick={postCommitment}>
                  Save
                </button>
                {commitmentPosted ? (
                  <p className="commitment-line">Saved for {commitmentName}.</p>
                ) : null}
              </div>

              <div className="survey-box">
                <p>Was this useful?</p>
                <div className="survey-actions">
                  {["Too busy", "Okay", "Very supported"].map((option) => (
                    <button key={option} type="button" onClick={() => setFeedback(option)}>
                      {option}
                    </button>
                  ))}
                </div>
                {feedback ? <p className="feedback-line">Saved: {feedback}</p> : null}
              </div>
            </section>
          ) : null}
        </section>
      </section>
    </>
  );
}

function ProfilePage({ profile, setProfile, onSave, syncMessage, saving }) {
  const [restrictions, setRestrictions] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/dietary-restrictions`)
      .then((r) => r.json())
      .then((data) => setRestrictions(Array.isArray(data) ? data : []))
      .catch(() => setRestrictions([]));
  }, []);

  const updateDietary = (name) => {
    setProfile((current) => ({
      ...current,
      dietary: {
        ...current.dietary,
        [name]: !current.dietary[name]
      }
    }));
  };

  return (
    <>
      <h2 className="section-title">Your Profile</h2>
      <p className="sync-line">{syncMessage}</p>

      <section className="card gradient-card profile-card">
        <h3>Identity</h3>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={profile.name || ""}
          onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={profile.email}
          onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
        />
      </section>

      <section className="card gradient-card profile-card">
        <h3>Dietary Preferences & Restrictions</h3>
        {restrictions.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading...</p>
        ) : (
          <div className="preference-grid">
            {restrictions.map((r) => (
              <button
                key={r.restriction_id}
                type="button"
                className={`toggle-tile ${profile.dietary[r.dietary_restriction_name] ? "on" : ""}`}
                onClick={() => updateDietary(r.dietary_restriction_name)}
              >
                {r.dietary_restriction_name.charAt(0).toUpperCase() + r.dietary_restriction_name.slice(1)}
              </button>
            ))}
          </div>
        )}
        <textarea
          placeholder="Allergies or notes (e.g. no peanuts, lactose intolerant)"
          value={profile.notes}
          onChange={(event) => setProfile((current) => ({ ...current, notes: event.target.value }))}
        />
      </section>

      <button className="save-btn" type="button" onClick={onSave} disabled={saving}>
        {saving ? "Saving profile..." : "Save Profile"}
      </button>
    </>
  );
}

function SettingsPage({ settings, setSettings, onSave, syncMessage, saving }) {
  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification("Just Cook It", { body: "Progress nudges are enabled." });
    }
  };

  return (
    <>
      <h2 className="section-title">Settings</h2>
      <p className="sync-line">{syncMessage}</p>

      <section className="card gradient-card settings-card">
        <h3>Experience</h3>
        <div className="interactive-row">
          <span>Enable notifications</span>
          <button
            type="button"
            className={`toggle-switch ${settings.notifications ? "on" : ""}`}
            onClick={async () => {
              updateSetting("notifications", !settings.notifications);
              await requestNotificationPermission();
            }}
          >
            {settings.notifications ? "On" : "Off"}
          </button>
        </div>

        <div className="interactive-row">
          <span>Email recipe updates</span>
          <button
            type="button"
            className={`toggle-switch ${settings.emailRecipeUpdates ? "on" : ""}`}
            onClick={() => updateSetting("emailRecipeUpdates", !settings.emailRecipeUpdates)}
          >
            {settings.emailRecipeUpdates ? "On" : "Off"}
          </button>
        </div>

        <div className="interactive-row">
          <span>Weekly digest email</span>
          <button
            type="button"
            className={`toggle-switch ${settings.weeklyDigestEmail ? "on" : ""}`}
            onClick={() => updateSetting("weeklyDigestEmail", !settings.weeklyDigestEmail)}
          >
            {settings.weeklyDigestEmail ? "On" : "Off"}
          </button>
        </div>

        <div className="interactive-row">
          <span>Show quick recipes first</span>
          <button
            type="button"
            className={`toggle-switch ${settings.quickRecipes ? "on" : ""}`}
            onClick={() => updateSetting("quickRecipes", !settings.quickRecipes)}
          >
            {settings.quickRecipes ? "On" : "Off"}
          </button>
        </div>

        <label htmlFor="units">Units</label>
        <select
          id="units"
          value={settings.units}
          onChange={(event) => updateSetting("units", event.target.value)}
        >
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
        </select>

        <label htmlFor="language">Language</label>
        <select
          id="language"
          value={settings.language}
          onChange={(event) => updateSetting("language", event.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
        </select>

        <label htmlFor="theme">Theme</label>
        <select
          id="theme"
          value={settings.theme}
          onChange={(event) => updateSetting("theme", event.target.value)}
        >
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>

        <label htmlFor="defaultResultCount">Default result count</label>
        <select
          id="defaultResultCount"
          value={settings.defaultResultCount}
          onChange={(event) => updateSetting("defaultResultCount", Number(event.target.value))}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={20}>20</option>
        </select>

        <label htmlFor="defaultMaxCookTime">Default max cook time (minutes)</label>
        <input
          id="defaultMaxCookTime"
          type="number"
          min="0"
          max="300"
          placeholder="0 means no default limit"
          value={settings.defaultMaxCookTime}
          onChange={(event) => updateSetting("defaultMaxCookTime", Number(event.target.value || 0))}
        />

        <div className="interactive-row">
          <span>Allow usage analytics</span>
          <button
            type="button"
            className={`toggle-switch ${settings.allowUsageAnalytics ? "on" : ""}`}
            onClick={() => updateSetting("allowUsageAnalytics", !settings.allowUsageAnalytics)}
          >
            {settings.allowUsageAnalytics ? "On" : "Off"}
          </button>
        </div>

        <div className="interactive-row">
          <span>Progress nudges</span>
          <button
            type="button"
            className={`toggle-switch ${settings.allowProgressNudges ? "on" : ""}`}
            onClick={() => updateSetting("allowProgressNudges", !settings.allowProgressNudges)}
          >
            {settings.allowProgressNudges ? "On" : "Off"}
          </button>
        </div>

        <div className="interactive-row">
          <span>Public profile</span>
          <button
            type="button"
            className={`toggle-switch ${settings.publicProfile ? "on" : ""}`}
            onClick={() => updateSetting("publicProfile", !settings.publicProfile)}
          >
            {settings.publicProfile ? "On" : "Off"}
          </button>
        </div>
      </section>

      <button className="save-btn" type="button" onClick={onSave} disabled={saving}>
        {saving ? "Saving settings..." : "Save Settings"}
      </button>
    </>
  );
}

function CursorAura() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (prefersReducedMotion || !finePointer) return;

    setEnabled(true);
    const onMove = (event) => setPosition({ x: event.clientX, y: event.clientY });
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        className={`cursor-aura ${pressed ? "pressed" : ""}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      />
      <div
        className="cursor-core"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      />
    </>
  );
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 20 }, (_, idx) => idx);
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece}
          className="confetti-piece"
          style={{
            left: `${(piece * 5) % 100}%`,
            animationDelay: `${(piece % 6) * 0.04}s`
          }}
        />
      ))}
    </div>
  );
}

export default App;
