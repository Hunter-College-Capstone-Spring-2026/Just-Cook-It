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

function mergeIngredientLists(base, incoming) {
  const seen = new Set();
  return [...base, ...incoming].filter((item) => {
    const cleaned = item?.trim();
    if (!cleaned) return false;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatRequestError(error, fallbackMessage) {
  const message = error?.message || "";
  if (message === "Load failed" || message === "Failed to fetch") {
    return "Could not connect to backend API. Start backend on http://localhost:4000.";
  }
  return message || fallbackMessage;
}

function App() {
  const [authUser, setAuthUser] = useLocalStorage("jci_auth_user", null);
  const [activePage, setActivePage] = useState("home");
  const [profile, setProfile] = useLocalStorage("jci_profile", defaultProfile);
  const [settings, setSettings] = useLocalStorage(
    "jci_settings",
    defaultSettings
  );
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [savedRecipeIds, setSavedRecipeIds] = useLocalStorage(
    "jci_saved_recipes",
    []
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

  const navItems = isLoggedIn
    ? [
        { id: "home", label: "Home" },
        { id: "profile", label: "Profile" },
        { id: "settings", label: "Settings" },
      ]
    : [];

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
      // ignore
    }
    setAuthUser(null);
    setProfile(defaultProfile);
    setActivePage("signin");
    setSelectedRecipe(null);
  };

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
                  onClick={() => {
                    setActivePage(item.id);
                    if (item.id !== "home") setSelectedRecipe(null);
                  }}
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
          {activePage === "home" && !selectedRecipe && (
            <HomePage
              settings={settings}
              userId={userId}
              onOpenRecipe={(recipe) => {
                setSelectedRecipe(recipe);
                setActivePage("home");
              }}
              savedRecipeIds={savedRecipeIds}
              setSavedRecipeIds={setSavedRecipeIds}
            />
          )}

          {activePage === "home" && selectedRecipe && (
            <RecipeDetailsPage
              recipe={selectedRecipe}
              userId={userId}
              onBack={() => setSelectedRecipe(null)}
              savedRecipeIds={savedRecipeIds}
              setSavedRecipeIds={setSavedRecipeIds}
            />
          )}

          {activePage === "profile" && (
            <ProfilePage
              userId={userId}
              profile={profile}
              setProfile={setProfile}
              settings={settings}
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
            onClick={() => {
              setActivePage(item.id);
              if (item.id !== "home") setSelectedRecipe(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}

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
      setError(
        formatRequestError(
          err,
          "Could not sign in. Check your credentials."
        )
      );
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
      onSuccess({
        userId: payload.userId,
        email: payload.email,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
    } catch (err) {
      setError(formatRequestError(err, "Could not create account."));
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
        <label htmlFor="signup-name">Name</label>
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

function HomePage({
  settings,
  userId,
  onOpenRecipe,
  savedRecipeIds,
  setSavedRecipeIds,
}) {
  const [inputValue, setInputValue] = useState("");
  const [maxTimeMinutes, setMaxTimeMinutes] = useState("");
  const [rankingMode, setRankingMode] = useState("missing");
  const [visibleChars, setVisibleChars] = useState(0);
  const [showInteraction, setShowInteraction] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [pantryItems, setPantryItems] = useLocalStorage(
    `jci_pantry_${userId || "guest"}`,
    []
  );
  const [pantryMessage, setPantryMessage] = useState("");
  const [pantryError, setPantryError] = useState("");
  const [removingPantryItem, setRemovingPantryItem] = useState("");
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [queuedPantryAdds, setQueuedPantryAdds] = useLocalStorage(
    "jci_queued_pantry_adds",
    []
  );

  const welcomeText = "Welcome!";
  const characters = useMemo(() => welcomeText.split(""), [welcomeText]);
  const resultCount = settings.quickRecipes ? 5 : 10;
  const ignorePantry = true;

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
    let cancelled = false;
    const loadPantry = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/pantry?userId=${encodeURIComponent(userId)}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && Array.isArray(payload.ingredients)) {
          setPantryItems((current) =>
            mergeIngredientLists(current, payload.ingredients)
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
                mergeIngredientLists(current, payload.ingredients)
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
          `${API_BASE_URL}/api/pantry?userId=${encodeURIComponent(userId)}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (Array.isArray(payload.ingredients)) {
          setPantryItems((current) =>
            mergeIngredientLists(current, payload.ingredients)
          );
        }
      } catch {
        // ignore
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [online, userId, setPantryItems]);

  const parseIngredients = () =>
    inputValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const toggleSavedRecipe = (recipeId) => {
    setSavedRecipeIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId]
    );
  };

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
        userId,
        ingredients,
        number: String(resultCount),
        ranking: rankingMode === "used" ? "1" : "2",
        ignorePantry: String(ignorePantry),
      });

      if (maxTimeMinutes) query.set("maxTime", maxTimeMinutes);

      const response = await fetch(
        `${API_BASE_URL}/recipes/search?${query.toString()}`
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ||
            payload?.detail ||
            "Unable to fetch recipe ideas right now."
        );
      }

      const mappedRecipes = (payload.results || []).map((recipe) => ({
        id: recipe.recipeId,
        title: recipe.recipeName,
        imageUrl: recipe.recipeImageUrl,
        readyTime: recipe.readyInMinutes,
        usedIngredientCount: recipe.usedIngredientCount,
        missedIngredientCount: recipe.missedIngredientCount,
        missedIngredients: recipe.missedIngredients || [],
        usedIngredients: recipe.usedIngredients || [],
        allIngredients: recipe.allIngredients || [],
      }));

      setRecipes(mappedRecipes);
    } catch (requestError) {
      setApiError(
        formatRequestError(requestError, "Could not connect to backend API.")
      );
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const removeFromPantry = async (ingredientName) => {
    if (!online) {
      setPantryError("Go online to remove pantry items.");
      setPantryMessage("");
      return;
    }

    setRemovingPantryItem(ingredientName);
    setPantryError("");
    setPantryMessage("");

    const previousPantry = pantryItems;
    setPantryItems((current) =>
      current.filter(
        (item) => item.toLowerCase() !== ingredientName.toLowerCase()
      )
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/pantry/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ingredient_name: ingredientName,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.detail || "Could not remove from pantry.");
      setPantryItems(
        Array.isArray(payload.ingredients) ? payload.ingredients : []
      );
      setPantryMessage(`Removed ${ingredientName} from pantry.`);
    } catch (requestError) {
      setPantryItems(previousPantry);
      setPantryError(requestError?.message || "Could not remove from pantry.");
    } finally {
      setRemovingPantryItem("");
    }
  };

  const applyIngredientSuggestion = (value) => {
    setInputValue((current) => (current ? `${current}, ${value}` : value));
  };

  const clearIngredients = () => {
    setInputValue("");
    setError("");
    setApiError("");
    setPantryError("");
    setPantryMessage("");
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
        <section
          className="initial-search-panel gradient-card"
          aria-label="Search by ingredients"
        >
          <h3 className="initial-search-title">Cook from what you have</h3>
          <p className="search-subtitle">
            Find a recipe match, then open the recipe page to cook it.
          </p>

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

          <div className="search-fields">
            <label htmlFor="userInput">Ingredients (comma-separated)</label>
            <div className="ingredient-input-row">
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
              <button
                type="button"
                className="clear-btn"
                onClick={clearIngredients}
                disabled={!inputValue.trim()}
              >
                Clear
              </button>
            </div>

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

            <label htmlFor="rankingMode">Rank results by</label>
            <select
              id="rankingMode"
              value={rankingMode}
              onChange={(event) => setRankingMode(event.target.value)}
            >
              <option value="missing">Fewest missing ingredients</option>
              <option value="used">Most used ingredients</option>
            </select>
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

          <div className="search-actions">
            <button
              className="search-action-btn"
              id="actionBtn"
              type="button"
              onClick={searchRecipes}
              disabled={loading}
            >
              {loading ? "Finding recipes..." : "Search Recipes"}
            </button>
          </div>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {apiError ? <p className="error-text">{apiError}</p> : null}
        {pantryError ? <p className="error-text">{pantryError}</p> : null}
        {pantryMessage ? <p className="sync-line">{pantryMessage}</p> : null}

        <section className="card gradient-card pantry-panel" aria-label="Pantry">
          <div className="pantry-panel-top">
            <div>
              <h4 className="section-title">Your pantry</h4>
              <p className="sync-line pantry-summary">
                {pantryItems.length > 0
                  ? "Saved ingredients for future recipe suggestions. No quantities, just a simple list."
                  : "No pantry items yet. Add ingredients above to save them here."}
              </p>
            </div>
          </div>

          {!online && pantryItems.length > 0 ? (
            <p className="sync-line pantry-offline-note">
              Go online to remove pantry items. Offline adds will still queue.
            </p>
          ) : null}

          {pantryItems.length > 0 ? (
            <ul className="pantry-list">
              {pantryItems.map((item) => (
                <li key={item} className="pantry-chip">
                  <span>{item}</span>
                  <button
                    type="button"
                    className="pantry-remove-btn"
                    onClick={() => removeFromPantry(item)}
                    disabled={!online || removingPantryItem === item}
                  >
                    {removingPantryItem === item ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

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
              <li key={recipe.id} className="recipe-card gradient-card">
                <div className="recipe-card-top">
                  <button
                    type="button"
                    className={`save-icon-btn ${
                      savedRecipeIds.includes(recipe.id) ? "saved" : ""
                    }`}
                    onClick={() => toggleSavedRecipe(recipe.id)}
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
                  onClick={() => onOpenRecipe(recipe)}
                >
                  Cook it
                </button>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </>
  );
}

function RecipeDetailsPage({
  recipe,
  userId,
  onBack,
  savedRecipeIds,
  setSavedRecipeIds,
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cookError, setCookError] = useState("");
  const [cooking, setCooking] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRecipeDetails = async () => {
      setLoading(true);
      setCookError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/recipes/api/spoonacular/recipes/${recipe.id}`
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.detail || "Could not load recipe details.");
        }

        if (!cancelled) setDetails(payload);
      } catch (error) {
        if (!cancelled) {
          setCookError(error.message || "Could not load recipe details.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRecipeDetails();

    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  const toggleSavedRecipe = () => {
    setSavedRecipeIds((current) =>
      current.includes(recipe.id)
        ? current.filter((id) => id !== recipe.id)
        : [...current, recipe.id]
    );
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
        ctx.currentTime + 0.22
      );
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      oscillator.stop(ctx.currentTime + 0.24);
    } catch {
      // no-op
    }
  };

  const markAsCooked = async () => {
    const source = details || recipe;
    const ingredientNames = Array.from(
      new Set(
        (source.extendedIngredients || [])
          .map((item) => item?.name || item?.originalName || item?.original)
          .filter(Boolean)
          .map((item) => item.trim())
      )
    );

    if (ingredientNames.length === 0) {
      setCookError("No ingredients were found for this recipe.");
      return;
    }

    setCooking(true);
    setCookError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/pantry/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ingredients: ingredientNames.map((name) => ({ name })),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || "Could not mark recipe as cooked.");
      }

      setCelebrate(true);
      playSuccessChime();
      setTimeout(() => setCelebrate(false), 1000);
    } catch (error) {
      setCookError(error.message || "Could not mark recipe as cooked.");
    } finally {
      setCooking(false);
    }
  };

  return (
    <section className="card gradient-card profile-card">
      {celebrate ? <ConfettiBurst /> : null}

      <div className="recipe-details-top">
        <button type="button" className="nav-btn" onClick={onBack}>
          ← Back
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
          <ul className="recipe-detail-list">
            {(details.extendedIngredients || []).map((ingredient, index) => (
              <li key={ingredient.id ?? `${ingredient.name}-${index}`}>
                {ingredient.original ||
                  ingredient.originalName ||
                  ingredient.name}
              </li>
            ))}
          </ul>

          <h3>Instructions</h3>
          {details.instructions ? (
            <div
              className="recipe-instructions"
              dangerouslySetInnerHTML={{ __html: details.instructions }}
            />
          ) : (
            <p className="sync-line">No instructions available for this recipe.</p>
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

function ProfilePage({
  userId,
  profile,
  setProfile,
  settings,
  onSave,
  syncMessage,
  saving,
}) {
  const [restrictions, setRestrictions] = useState([]);
  const [pantryItems, setPantryItems] = useState([]);
  const [recipeIdeas, setRecipeIdeas] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState("");

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
          `${API_BASE_URL}/api/pantry?userId=${encodeURIComponent(userId)}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) {
          setPantryItems(
            Array.isArray(payload.ingredients) ? payload.ingredients : []
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
          ingredients: pantryItems.join(","),
          number: String(settings.quickRecipes ? 3 : 5),
          ranking: "2",
          ignorePantry: "true",
        });

        const response = await fetch(
          `${API_BASE_URL}/recipes/search?${query.toString()}`
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ||
              payload?.detail ||
              "Could not load recipe ideas."
          );
        }

        if (!cancelled) setRecipeIdeas(payload.results || []);
      } catch (error) {
        if (!cancelled) {
          setRecipeIdeas([]);
          setIdeasError(
            formatRequestError(error, "Could not load recipe ideas.")
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
  }, [pantryItems, settings.quickRecipes, userId]);

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

      <section className="card gradient-card profile-card">
        <h3>Your Pantry</h3>
        <p className="sync-line">
          {pantryItems.length > 0
            ? "These saved ingredients shape your future recipe suggestions."
            : "Cook a recipe on Home to start building your pantry automatically."}
        </p>

        {pantryItems.length > 0 ? (
          <ul className="pantry-list">
            {pantryItems.map((item) => (
              <li key={item} className="pantry-chip">
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card gradient-card profile-card">
        <h3>What To Cook Next</h3>
        {ideasLoading ? (
          <p className="sync-line">Finding recipes from your pantry...</p>
        ) : null}

        {ideasError ? <p className="error-text">{ideasError}</p> : null}

        {!ideasLoading && !ideasError && pantryItems.length === 0 ? (
          <p className="sync-line">
            Your next recipe suggestions will appear here after you cook and
            save ingredients to pantry.
          </p>
        ) : null}

        {!ideasLoading && !ideasError && pantryItems.length > 0 ? (
          <ul className="recipe-list">
            {recipeIdeas.length > 0 ? (
              recipeIdeas.map((recipe) => (
                <li key={recipe.recipeId} className="recipe-card gradient-card">
                  <p className="recipe-title">{recipe.recipeName}</p>
                  <p className="recipe-meta">
                    ⏱ {recipe.readyInMinutes ?? "?"} min • Uses{" "}
                    {recipe.usedIngredientCount ?? 0} • Missing{" "}
                    {recipe.missedIngredientCount ?? 0}
                  </p>
                </li>
              ))
            ) : (
              <p className="sync-line">
                No recipe ideas yet. Try cooking one recipe on Home first.
              </p>
            )}
          </ul>
        ) : null}
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