import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const defaultProfile = {
  email: "",
  name: "",
  dietary: {
    vegetarian: false,
    vegan: false,
    halal: false,
    glutenFree: false,
  },
  notes: "",
};

const defaultSettings = {
  notifications: true,
  quickRecipes: true,
  units: "metric",
  allowUsageAnalytics: false,
  allowProgressNudges: true,
};

const SUPPORTIVE_LINES = [
  "You are doing a lot. Let's make this one thing easy.",
  "No pressure. We can find something simple in under a minute.",
  "You showed up. That's enough for today. We'll handle the recipe part.",
  "Take one breath. Type what you have, and we will do the heavy lifting.",
];

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
      ...(incoming?.dietary || {}),
    },
  };
}

// ─── Auth Context ────────────────────────────────────────────────────────────

function App() {
  // Auth state
  const [authUser, setAuthUser] = useLocalStorage("jci_auth_user", null);
  // authUser shape: { userId, email, accessToken, refreshToken }

  const [activePage, setActivePage] = useState("home");
  const [profile, setProfile] = useLocalStorage("jci_profile", defaultProfile);
  const [settings, setSettings] = useLocalStorage(
    "jci_settings",
    defaultSettings
  );

  const userId = authUser?.userId || null;

  const [profileSyncMessage, setProfileSyncMessage] = useState(
    "Profile stored locally."
  );
  const [settingsSyncMessage, setSettingsSyncMessage] = useState(
    "Settings stored locally."
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const isLoggedIn = !!authUser;

  // Nav items only available when logged in
  const navItems = isLoggedIn
    ? [
        { id: "home", label: "Home" },
        { id: "profile", label: "Profile" },
        { id: "settings", label: "Settings" },
      ]
    : [];

  // Redirect to login page if not authenticated
  useEffect(() => {
    if (!isLoggedIn && activePage !== "signup") {
      setActivePage("signin");
    }
  }, [isLoggedIn, activePage]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const loadRemoteState = async () => {
      try {
        const [profileResp, settingsResp] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/users/profile?userId=${encodeURIComponent(
              userId
            )}`
          ),
          fetch(
            `${API_BASE_URL}/api/users/settings?userId=${encodeURIComponent(
              userId
            )}`
          ),
        ]);

        if (profileResp.ok) {
          const profilePayload = await profileResp.json();
          if (isMounted) {
            setProfile((current) => mergeProfile(current, profilePayload));
            setProfileSyncMessage("Profile synced with Supabase.");
          }
        } else if (isMounted) {
          setProfileSyncMessage(
            "Using local profile (Supabase profile sync unavailable)."
          );
        }

        if (settingsResp.ok) {
          const settingsPayload = await settingsResp.json();
          if (isMounted) {
            setSettings((current) => ({ ...current, ...settingsPayload }));
            setSettingsSyncMessage("Settings synced with Supabase.");
          }
        } else if (isMounted) {
          setSettingsSyncMessage(
            "Using local settings (Supabase settings sync unavailable)."
          );
        }
      } catch {
        if (isMounted) {
          setProfileSyncMessage(
            "Using local profile (could not reach backend)."
          );
          setSettingsSyncMessage(
            "Using local settings (could not reach backend)."
          );
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
        body: JSON.stringify({ userId, ...profile }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.detail || "Profile save failed.");
      setProfileSyncMessage(
        payload.warning
          ? `Saved with warning: ${payload.warning}`
          : "Profile saved to Supabase."
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
      if (!response.ok)
        throw new Error(payload?.detail || "Settings save failed.");
      setSettingsSyncMessage(
        payload.warning
          ? `Saved with warning: ${payload.warning}`
          : "Settings saved to Supabase."
      );
    } catch (error) {
      setSettingsSyncMessage(error.message || "Settings saved locally only.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/signout`, { method: "POST" });
    } catch {
      // ignore network errors on signout
    }
    setAuthUser(null);
    setProfile(defaultProfile);
    setActivePage("signin");
  };

  // Show auth pages when not logged in
  if (!isLoggedIn) {
    return (
      <>
        <CursorAura />
        <header className="navbar">
          <h1 className="logo">Just Cook It!</h1>
          <nav>
            <ul className="nav-links">
              <li>
                <button
                  type="button"
                  className={`nav-btn ${
                    activePage === "signin" ? "active" : ""
                  }`}
                  onClick={() => setActivePage("signin")}
                >
                  Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-btn ${
                    activePage === "signup" ? "active" : ""
                  }`}
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
      </>
    );
  }

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
                  className={`nav-btn ${
                    activePage === item.id ? "active" : ""
                  }`}
                  onClick={() => setActivePage(item.id)}
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
        <section key={activePage} className="page-shell" aria-live="polite">
          {activePage === "home" && (
            <HomePage settings={settings} userId={userId} />
          )}
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
            className={`quick-nav-btn ${
              activePage === item.id ? "active" : ""
            }`}
            onClick={() => setActivePage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}

// ─── Sign In Page ─────────────────────────────────────────────────────────────

function SignInPage({ onSuccess, onGoToSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Sign in failed.");
      }
      onSuccess({
        userId: payload.userId,
        email: payload.email,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
    } catch (err) {
      setError(err.message || "Could not sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto" }}>
      <h2 className="section-title">Welcome back</h2>
      <p className="sync-line">Sign in to access your recipes and pantry.</p>

      <section className="card gradient-card">
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          autoComplete="email"
        />

        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          autoComplete="current-password"
        />

        {error && <p className="error-text">{error}</p>}

        <button
          type="button"
          className="save-btn"
          style={{ marginTop: "1rem" }}
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </section>

      <p
        className="sync-line"
        style={{ textAlign: "center", marginTop: "1rem" }}
      >
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onGoToSignUp}
          style={{
            background: "none",
            border: "none",
            color: "var(--brand-dark)",
            cursor: "pointer",
            fontWeight: 700,
            padding: 0,
            width: "auto",
            margin: 0,
            fontSize: "inherit",
            textDecoration: "underline",
          }}
        >
          Sign up
        </button>
      </p>
    </div>
  );
}

// ─── Sign Up Page ─────────────────────────────────────────────────────────────

function SignUpPage({ onSuccess, onGoToSignIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSignUp = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Sign up failed.");
      }
      // Supabase may require email confirmation — handle both flows
      if (payload.accessToken) {
        onSuccess({
          userId: payload.userId,
          email: payload.email,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        });
      } else {
        // Email confirmation required
        setSuccessMsg(
          "Account created! Check your email to confirm your account, then sign in."
        );
      }
    } catch (err) {
      setError(err.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto" }}>
      <h2 className="section-title">Create your account</h2>
      <p className="sync-line">
        Join Just Cook It to save recipes and manage your pantry.
      </p>

      <section className="card gradient-card">
        <label htmlFor="signup-name">Name (optional)</label>
        <input
          id="signup-name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <label htmlFor="signup-confirm">Confirm password</label>
        <input
          id="signup-confirm"
          type="password"
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
          autoComplete="new-password"
        />

        {error && <p className="error-text">{error}</p>}
        {successMsg && (
          <p className="sync-line" style={{ color: "green" }}>
            {successMsg}
          </p>
        )}

        <button
          type="button"
          className="save-btn"
          style={{ marginTop: "1rem" }}
          onClick={handleSignUp}
          disabled={loading}
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </section>

      <p
        className="sync-line"
        style={{ textAlign: "center", marginTop: "1rem" }}
      >
        Already have an account?{" "}
        <button
          type="button"
          onClick={onGoToSignIn}
          style={{
            background: "none",
            border: "none",
            color: "var(--brand-dark)",
            cursor: "pointer",
            fontWeight: 700,
            padding: 0,
            width: "auto",
            margin: 0,
            fontSize: "inherit",
            textDecoration: "underline",
          }}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage({ settings, userId }) {
  const [inputValue, setInputValue] = useState("");
  const [maxTimeMinutes, setMaxTimeMinutes] = useState("");
  const [sortPriority, setSortPriority] = useState("missing");
  const [ignorePantry, setIgnorePantry] = useState(true);
  const [resultCount, setResultCount] = useState(
    settings.quickRecipes ? 5 : 10
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
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [queuedPantryAdds, setQueuedPantryAdds] = useLocalStorage(
    "jci_queued_pantry_adds",
    []
  );
  const [onboardingDismissed, setOnboardingDismissed] = useLocalStorage(
    "jci_onboarding_dismissed",
    false
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  const welcomeText = "Welcome!";
  const characters = useMemo(() => welcomeText.split(""), [welcomeText]);
  const supportiveMessage = useMemo(() => {
    const hour = new Date().getHours();
    const idx = hour % SUPPORTIVE_LINES.length;
    return SUPPORTIVE_LINES[idx];
  }, []);

  const progressStepsDone = [
    inputValue.trim().length > 0,
    recipes.length > 0,
    selectedRecipeId.length > 0,
  ].filter(Boolean).length;
  const progressPercent = Math.round((progressStepsDone / 3) * 100);
  const onboardingProgress = Math.round(
    (((inputValue.trim() ? 1 : 0) +
      (recipes.length > 0 ? 1 : 0) +
      (pantryItems.length > 0 ? 1 : 0)) /
      3) *
      100
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
        const response = await fetch(
          `${API_BASE_URL}/pantry?userId=${encodeURIComponent(userId)}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled)
          setPantryItems(
            Array.isArray(payload.ingredients) ? payload.ingredients : []
          );
      } catch {
        /* ignore */
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
            if (!cancelled && Array.isArray(payload.ingredients))
              setPantryItems(payload.ingredients);
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
  }, [online, queuedPantryAdds, setQueuedPantryAdds]);

  useEffect(() => {
    if (!online) return undefined;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/pantry?userId=${encodeURIComponent(userId)}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (Array.isArray(payload.ingredients))
          setPantryItems(payload.ingredients);
      } catch {
        /* ignore */
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [online, userId]);

  useEffect(() => {
    setResultCount(settings.quickRecipes ? 5 : 10);
  }, [settings.quickRecipes]);

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
        ignorePantry: String(ignorePantry),
      });
      if (maxTimeMinutes) query.set("maxTime", maxTimeMinutes);

      const response = await fetch(
        `${API_BASE_URL}/api/spoonacular/recipes/search?${query.toString()}`
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload?.error?.message ||
            payload?.detail ||
            "Unable to fetch recipe ideas right now."
        );

      const mappedRecipes = (payload.results || []).map((recipe) => ({
        id: recipe.recipeId,
        title: recipe.recipeName,
        imageUrl: recipe.recipeImageUrl,
        readyTime: recipe.readyInMinutes,
        usedIngredientCount: recipe.usedIngredientCount,
        missedIngredientCount: recipe.missedIngredientCount,
        missedIngredients: recipe.missedIngredients || [],
      }));

      const minUsedValue = minUsedFilter ? Number(minUsedFilter) : null;
      const maxMissingValue = maxMissingFilter
        ? Number(maxMissingFilter)
        : null;
      const filteredRecipes = mappedRecipes.filter((recipe) => {
        if (minUsedValue !== null && recipe.usedIngredientCount < minUsedValue)
          return false;
        if (
          maxMissingValue !== null &&
          recipe.missedIngredientCount > maxMissingValue
        )
          return false;
        return true;
      });
      const sortedRecipes = filteredRecipes.sort((a, b) => {
        if (sortPriority === "used") {
          if (b.usedIngredientCount !== a.usedIngredientCount)
            return b.usedIngredientCount - a.usedIngredientCount;
          return a.missedIngredientCount - b.missedIngredientCount;
        }
        if (a.missedIngredientCount !== b.missedIngredientCount)
          return a.missedIngredientCount - b.missedIngredientCount;
        return b.usedIngredientCount - a.usedIngredientCount;
      });
      setRecipes(sortedRecipes);
      setSelectedRecipeId("");
    } catch (requestError) {
      const message = requestError?.message || "";
      if (message === "Load failed" || message === "Failed to fetch") {
        setApiError(
          "Could not connect to backend API. Start backend on http://localhost:4000."
        );
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
        ingredients: ingredientList.map((name) => ({ name })),
      };
      if (!online) {
        setQueuedPantryAdds((current) => [...current, requestBody]);
        setPantryMessage(
          "Saved offline. Pantry will sync when connection returns."
        );
        return;
      }
      const response = await fetch(`${API_BASE_URL}/pantry/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.detail || "Could not add to pantry.");
      setPantryItems(
        Array.isArray(payload.ingredients) ? payload.ingredients : []
      );
      setPantryMessage(
        `Added ${ingredientList.length} ingredient${
          ingredientList.length > 1 ? "s" : ""
        } to pantry.`
      );
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

  const quickSets = [
    "rice",
    "eggs",
    "chicken",
    "onion",
    "tomato",
    "spinach",
    "beans",
  ];

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
        ctx.currentTime + 0.22
      );
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      oscillator.stop(ctx.currentTime + 0.24);
    } catch {
      /* no-op */
    }
  };

  const completeRecipePlan = (recipeId) => {
    setSelectedRecipeId(recipeId);
    setCelebrate(true);
    playSuccessChime();
    setTimeout(() => setCelebrate(false), 1000);
  };

  return (
    <>
      <h2 id="welcome" className="welcome-text" aria-label="Welcome">
        {characters.slice(0, visibleChars).map((char, index) => (
          <span
            key={`${char}-${index}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </h2>

      <section
        id="interaction"
        aria-live="polite"
        className={showInteraction ? "show" : ""}
      >
        {celebrate ? <ConfettiBurst /> : null}
        {!onboardingDismissed ? (
          <section className="card gradient-card onboarding-card">
            <div className="onboarding-top">
              <h4>Start in under 60 seconds</h4>
              <button
                type="button"
                className="chip-btn"
                onClick={() => setOnboardingDismissed(true)}
              >
                Dismiss
              </button>
            </div>
            <p>1) Add ingredients, 2) search, 3) save to pantry.</p>
            <div className="progress-strip" aria-label="Onboarding progress">
              <div
                className="progress-fill"
                style={{ width: `${onboardingProgress}%` }}
              />
            </div>
          </section>
        ) : null}
        <div className="pressure-banner">
          <p>{supportiveMessage}</p>
        </div>
        <section className="fogg-panel gradient-card">
          <h4>Your next win</h4>
          <p>
            Motivation: protect your energy now, and your future time later.
            Ability: use one ingredient if needed. Prompt: press{" "}
            <strong>Cook it!</strong> now.
          </p>
          <div className="progress-strip" aria-label="Task progress">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="progress-copy">
            Progress: {progressStepsDone}/3 actions complete
          </p>
        </section>
        <section
          className="initial-search-panel gradient-card"
          aria-label="Search by ingredients"
        >
          <h3 className="initial-search-title wave-title">
            What do you have in your kitchen?
          </h3>
          {!online ? (
            <p className="sync-line">
              Offline mode: searches may fail, pantry adds will queue.
            </p>
          ) : null}
          {queuedPantryAdds.length > 0 ? (
            <p className="sync-line">
              Queued pantry updates: {queuedPantryAdds.length}
            </p>
          ) : null}

          <div className="multi-filter-panel" aria-label="Search filters">
            <p className="filter-title">Sort priority</p>
            <div
              className="priority-toggle-group"
              role="group"
              aria-label="Sort priority"
            >
              <button
                type="button"
                className={`priority-toggle ${
                  sortPriority === "missing" ? "active" : ""
                }`}
                onClick={() => setSortPriority("missing")}
              >
                Fewer missing (default)
              </button>
              <button
                type="button"
                className={`priority-toggle ${
                  sortPriority === "used" ? "active" : ""
                }`}
                onClick={() => setSortPriority("used")}
              >
                Most used
              </button>
            </div>

            <div className="filter-grid">
              <div>
                <label htmlFor="resultCount">Result count</label>
                <select
                  id="resultCount"
                  value={resultCount}
                  onChange={(event) =>
                    setResultCount(Number(event.target.value))
                  }
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>
              <div>
                <label htmlFor="minUsedFilter">Min used ingredients</label>
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
                <label htmlFor="maxMissingFilter">
                  Max missing ingredients
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
              <div>
                <label htmlFor="ignorePantryToggle">
                  Ignore common ingredient staples (e.g. salt, water)
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
            <label htmlFor="userInput">Ingredients (comma-separated)</label>
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
            <label htmlFor="maxTimeInput">Max time (minutes)</label>
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

          <div
            className="quick-ingredients"
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

          <div id="nudge" className={`nudge ${showNudge ? "show" : "hidden"}`}>
            Not sure where to start? Try one ingredient.
          </div>

          <div className="search-actions">
            <button
              className="search-action-btn"
              id="actionBtn"
              type="button"
              onClick={searchRecipes}
              disabled={loading}
            >
              {loading ? "Finding recipes..." : "Cook it!"}
            </button>
            <button
              type="button"
              className="search-action-btn"
              onClick={addToPantry}
              disabled={savingPantry}
            >
              {savingPantry ? "Adding..." : "Add ingredients to pantry"}
            </button>
          </div>
          <p className="sync-line">
            Shortcut: press `/` to focus ingredients, `Cmd/Ctrl + Enter` to
            search.
          </p>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {apiError ? <p className="error-text">{apiError}</p> : null}
        {pantryError ? <p className="error-text">{pantryError}</p> : null}
        {pantryMessage ? <p className="sync-line">{pantryMessage}</p> : null}
        {pantryItems.length > 0 ? (
          <p className="sync-line">Pantry: {pantryItems.join(", ")}</p>
        ) : null}

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
            <p id="output">Your suggestions will appear here.</p>
          ) : null}
          <ul className="recipe-list">
            {recipes.map((recipe) => (
              <li
                key={recipe.id}
                className={`recipe-card gradient-card ${
                  selectedRecipeId === recipe.id ? "selected-recipe" : ""
                }`}
              >
                <p className="recipe-title">{recipe.title}</p>
                <p className="recipe-meta">
                  ⏱ {recipe.readyTime ?? "?"} min • Uses{" "}
                  {recipe.usedIngredientCount} • Missing{" "}
                  {recipe.missedIngredientCount}
                </p>
                <p>
                  Missing ingredients:{" "}
                  {recipe.missedIngredients.length
                    ? recipe.missedIngredients.join(", ")
                    : "None"}
                </p>
                <button
                  type="button"
                  className="plan-btn"
                  onClick={() => completeRecipePlan(recipe.id)}
                >
                  {selectedRecipeId === recipe.id
                    ? "Planned ✓"
                    : "I'll cook this"}
                </button>
              </li>
            ))}
          </ul>

          {selectedRecipeId ? (
            <section
              className="completion-panel gradient-card"
              aria-live="polite"
            >
              <h4>Plan locked in</h4>
              <p>
                Great call. You completed a high-pressure decision. This helps
                tonight and reduces tomorrow's stress too.
              </p>
            </section>
          ) : null}
        </section>
      </section>
    </>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

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
      dietary: { ...current.dietary, [name]: !current.dietary[name] },
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
      </section>

      <section className="card gradient-card profile-card">
        <h3>Dietary Preferences & Restrictions</h3>
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
          placeholder="Allergies or notes (e.g. no peanuts, lactose intolerant)"
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

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage({ settings, setSettings, onSave, syncMessage, saving }) {
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default")
      await Notification.requestPermission();
    if (Notification.permission === "granted") {
      new Notification("Just Cook It", {
        body: "Progress nudges are enabled.",
      });
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
              setSettings((current) => ({
                ...current,
                notifications: !current.notifications,
              }));
              await requestNotificationPermission();
            }}
          >
            {settings.notifications ? "On" : "Off"}
          </button>
        </div>
        <div className="interactive-row">
          <span>Show quick recipes first</span>
          <button
            type="button"
            className={`toggle-switch ${settings.quickRecipes ? "on" : ""}`}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                quickRecipes: !current.quickRecipes,
              }))
            }
          >
            {settings.quickRecipes ? "On" : "Off"}
          </button>
        </div>
        <label htmlFor="units">Units</label>
        <select
          id="units"
          value={settings.units}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              units: event.target.value,
            }))
          }
        >
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
        </select>
        <div className="interactive-row">
          <span>Allow usage analytics</span>
          <button
            type="button"
            className={`toggle-switch ${
              settings.allowUsageAnalytics ? "on" : ""
            }`}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                allowUsageAnalytics: !current.allowUsageAnalytics,
              }))
            }
          >
            {settings.allowUsageAnalytics ? "On" : "Off"}
          </button>
        </div>
        <div className="interactive-row">
          <span>Progress nudges</span>
          <button
            type="button"
            className={`toggle-switch ${
              settings.allowProgressNudges ? "on" : ""
            }`}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                allowProgressNudges: !current.allowProgressNudges,
              }))
            }
          >
            {settings.allowProgressNudges ? "On" : "Off"}
          </button>
        </div>
      </section>

      <button
        className="save-btn"
        type="button"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? "Saving settings..." : "Save Settings"}
      </button>
    </>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function CursorAura() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (prefersReducedMotion || !finePointer) return;
    setEnabled(true);
    const onMove = (event) =>
      setPosition({ x: event.clientX, y: event.clientY });
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
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      />
      <div
        className="cursor-core"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
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
            animationDelay: `${(piece % 6) * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}

export default App;
