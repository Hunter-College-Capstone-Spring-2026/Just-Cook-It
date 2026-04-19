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

function splitInstructionText(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text])
    .map((step) => step.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractInstructionBlocks(instructions) {
  if (!instructions) return [];

  if (typeof window !== "undefined" && "DOMParser" in window) {
    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(instructions, "text/html");

      const listItems = Array.from(doc.querySelectorAll("li"))
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (listItems.length > 0) return listItems;

      const paragraphs = Array.from(doc.querySelectorAll("p"))
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (paragraphs.length > 1) return paragraphs;

      const plainText = doc.body.textContent?.replace(/\s+/g, " ").trim() || "";
      return plainText ? splitInstructionText(plainText) : [];
    } catch {
      // Fall through to the plain-text cleanup below.
    }
  }

  const plainText = instructions
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plainText ? splitInstructionText(plainText) : [];
}

function buildGuideSteps(recipeDetails) {
  const analyzedSteps = (recipeDetails?.analyzedInstructions || [])
    .flatMap((section) => (Array.isArray(section?.steps) ? section.steps : []))
    .map((step, index) => ({
      number: index + 1,
      text: step?.step?.trim() || "",
      ingredients: mergeIngredientLists(
        [],
        (step?.ingredients || []).map((item) => item?.name || ""),
      ),
      equipment: mergeIngredientLists(
        [],
        (step?.equipment || []).map((item) => item?.name || ""),
      ),
      duration:
        step?.length?.number && step?.length?.unit
          ? `${step.length.number} ${step.length.unit}`
          : "",
    }))
    .filter((step) => step.text);

  if (analyzedSteps.length > 0) return analyzedSteps;

  return extractInstructionBlocks(recipeDetails?.instructions).map(
    (text, index) => ({
      number: index + 1,
      text,
      ingredients: [],
      equipment: [],
      duration: "",
    }),
  );
}

const CUISINE_KEYWORDS = {
  Italian: ["italian", "pasta", "risotto", "parmesan", "alfredo", "marinara"],
  Mexican: ["mexican", "taco", "quesadilla", "enchilada", "salsa", "burrito"],
  Indian: ["indian", "curry", "masala", "tikka", "naan", "dal"],
  Japanese: ["japanese", "ramen", "teriyaki", "miso", "udon", "sushi"],
  Chinese: ["chinese", "lo mein", "fried rice", "dumpling", "wonton"],
  Thai: ["thai", "pad thai", "coconut curry", "satay", "lemongrass"],
  Korean: ["korean", "kimchi", "bulgogi", "gochujang"],
  Mediterranean: ["mediterranean", "hummus", "falafel", "tabbouleh", "tahini"],
  Greek: ["greek", "tzatziki", "feta", "gyro", "orzo"],
  French: ["french", "gratin", "coq au vin", "crepe", "quiche"],
  Spanish: ["spanish", "paella", "patatas bravas", "chorizo"],
  American: ["burger", "barbecue", "bbq", "mac and cheese", "meatloaf"],
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  return values
    .map((item) => cleanText(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeCookedRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return null;

  const recipeId = Number(recipe.recipeId ?? recipe.id);
  const title = cleanText(recipe.title ?? recipe.recipeName);
  if (!Number.isFinite(recipeId) || !title) return null;

  const readyInMinutes = Number.isFinite(Number(recipe.readyInMinutes))
    ? Number(recipe.readyInMinutes)
    : null;

  return {
    recipeId,
    title,
    image: cleanText(recipe.image),
    readyInMinutes,
    cuisines: normalizeStringList(recipe.cuisines),
    dishTypes: normalizeStringList(recipe.dishTypes),
    ingredients: normalizeStringList(recipe.ingredients),
    cookedAt: cleanText(recipe.cookedAt) || new Date().toISOString(),
  };
}

function mergeCookedRecipes(base, incoming) {
  const combined = [...(incoming || []), ...(base || [])]
    .map((recipe) => normalizeCookedRecipe(recipe))
    .filter(Boolean);

  const deduped = new Map();
  combined.forEach((recipe) => {
    const key = `${recipe.recipeId}-${recipe.cookedAt}`;
    if (!deduped.has(key)) {
      deduped.set(key, recipe);
    }
  });

  return Array.from(deduped.values())
    .sort(
      (left, right) =>
        new Date(right.cookedAt).getTime() - new Date(left.cookedAt).getTime(),
    )
    .slice(0, 30);
}

function inferRecipeCuisines(recipe) {
  const direct = normalizeStringList(recipe?.cuisines);
  if (direct.length > 0) return direct;

  const haystack = [
    cleanText(recipe?.title),
    ...normalizeStringList(recipe?.dishTypes),
    ...normalizeStringList(recipe?.ingredients),
  ]
    .join(" ")
    .toLowerCase();

  return Object.entries(CUISINE_KEYWORDS)
    .filter(([, keywords]) =>
      keywords.some((keyword) => haystack.includes(keyword)),
    )
    .map(([cuisine]) => cuisine);
}

function analyzeCookedRecipes(recipes) {
  const counts = new Map();

  (recipes || []).forEach((recipe) => {
    inferRecipeCuisines(recipe).forEach((cuisine) => {
      counts.set(cuisine, (counts.get(cuisine) || 0) + 1);
    });
  });

  const breakdown = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }))
    .slice(0, 4);

  if (breakdown.length === 0) {
    return {
      favoriteCuisine: "Still forming",
      note: "Cook a few dishes to reveal it.",
      breakdown: [],
    };
  }

  const [first, second] = breakdown;
  return {
    favoriteCuisine: first.label,
    note: second
      ? `${first.label} leads. ${second.label} next.`
      : `${first.label} leads.`,
    breakdown,
  };
}

function formatCookedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function CookingPanIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="panBody" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffca98" />
          <stop offset="100%" stopColor="#ff945f" />
        </linearGradient>
        <linearGradient id="panGlow" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,236,222,0.4)" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="evenodd">
        <path
          d="M44 96c0-16.6 13.4-30 30-30h23c18.8 0 34 15.2 34 34v4H52c-4.4 0-8-3.6-8-8Z"
          fill="url(#panBody)"
          stroke="#c9643d"
          strokeWidth="4"
        />
        <path
          d="M110 87h18c10.5 0 19 8.5 19 19"
          stroke="#c9643d"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path
          d="M54 104h78"
          stroke="url(#panGlow)"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <ellipse cx="82" cy="98" rx="22" ry="9" fill="#fff3e8" opacity="0.8" />
        <path
          d="M67 63c-6-7-5-13 2-18M88 54c-6-7-5-13 2-18M108 63c-6-7-5-13 2-18"
          stroke="#d66f4b"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <circle cx="54" cy="34" r="10" fill="#fff8f2" opacity="0.8" />
        <circle cx="122" cy="38" r="7" fill="#fff1e8" opacity="0.75" />
      </g>
    </svg>
  );
}

function App() {
  const [authUser, setAuthUser] = useLocalStorage("jci_auth_user", null);
  const [activePage, setActivePage] = useState("home");
  const [appReady, setAppReady] = useState(false);
  const [profile, setProfile] = useState(defaultProfile);
  const [settings, setSettings] = useState(defaultSettings);

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [cookedRecipes, setCookedRecipes] = useState([]);

  const [pantryLanding, setPantryLanding] = useState({
    pantryItems: [],
    recentlyAdded: [],
    recipeTitle: "",
  });
  const [savedRecipeIds, setSavedRecipeIds] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const userId = authUser?.userId || null;

  const [profileSyncMessage, setProfileSyncMessage] = useState(
    "Profile stored locally.",
  );
  const [settingsSyncMessage, setSettingsSyncMessage] = useState(
    "Settings stored locally.",
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingCookedHistory, setResettingCookedHistory] = useState(false);

  const isLoggedIn = !!authUser;

  const navItems = isLoggedIn
    ? [
        { id: "home", label: "Home" },
        { id: "pantry", label: "Pantry" },
        { id: "collections", label: "Saved" },
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
      setDataLoading(true);
      try {
        const [profileResp, settingsResp, savedResp] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/profile?userId=${encodeURIComponent(userId)}`),
          fetch(`${API_BASE_URL}/api/users/settings?userId=${encodeURIComponent(userId)}`),
          fetch(`${API_BASE_URL}/recipes/saved?userId=${encodeURIComponent(userId)}`),
        ]);
    
        if (profileResp.ok) {
          const profilePayload = await profileResp.json();
          if (isMounted) {
            const { cookedRecipes: remoteCookedRecipes = [], ...profileFields } = profilePayload;
            setProfile(mergeProfile(defaultProfile, profileFields));
            if (Array.isArray(remoteCookedRecipes)) {
              setCookedRecipes(remoteCookedRecipes.map(normalizeCookedRecipe).filter(Boolean));
            }
            setProfileSyncMessage("Profile synced.");
          }
        } else if (isMounted) {
          setProfileSyncMessage("Could not load profile.");
        }
    
        if (settingsResp.ok) {
          const settingsPayload = await settingsResp.json();
          if (isMounted) setSettings({ ...defaultSettings, ...settingsPayload });
        }
    
        if (savedResp.ok) {
          const savedPayload = await savedResp.json();
          if (isMounted && Array.isArray(savedPayload.recipes)) {
            setSavedRecipes(savedPayload.recipes);
            setSavedRecipeIds(savedPayload.recipes.map((r) => Number(r.recipeId)).filter(Boolean));
          }
        }
      } catch {
        if (isMounted) setProfileSyncMessage("Could not reach backend.");
      } finally {
        if (isMounted) setDataLoading(false);
      }
    };

    loadRemoteState();
    return () => {
      isMounted = false;
    };
  }, [setCookedRecipes, setProfile, setSettings, userId]);

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
      if (!response.ok)
        throw new Error(payload?.detail || "Settings save failed.");
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
      await fetch(`${API_BASE_URL}/api/auth/signout`, { method: "POST" });
    } catch {
      // ignore network errors on signout
    }
    setAuthUser(null);
    setProfile(defaultProfile);
    setActivePage("signin");
    setSelectedRecipe(null);
    setPantryLanding({
      pantryItems: [],
      recentlyAdded: [],
      recipeTitle: "",
    });
  };

  const handlePageChange = (pageId, options = {}) => {
    const { preservePantryContext = false } = options;

    setActivePage(pageId);
    if (pageId !== "home") {
      setSelectedRecipe(null);
    }

    if (pageId !== "pantry" || !preservePantryContext) {
      setPantryLanding((current) => ({
        ...current,
        recentlyAdded: [],
        recipeTitle: "",
      }));
    }
  };

  // Updates local cooked-recipe history only.
  // The DB write (UserRecipe.user_recipe_cooked_at) happens inside
  // POST /api/pantry/cook so there is no duplicate backend call here.
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
        `${API_BASE_URL}/api/users/cooked-recipes?userId=${encodeURIComponent(
          userId,
        )}`,
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

  const toggleSavedRecipe = async (recipe) => {
    const recipeId = Number(recipe.id ?? recipe.recipeId);
    if (!recipeId || !userId) return;
  
    // optimistic update for both ID list and full objects
    const isCurrentlySaved = savedRecipeIds.includes(recipeId);
    setSavedRecipeIds((curr) =>
      isCurrentlySaved ? curr.filter((id) => id !== recipeId) : [...curr, recipeId]
    );
    setSavedRecipes((curr) =>
      isCurrentlySaved
        ? curr.filter((r) => Number(r.recipeId) !== recipeId)
        : [...curr, { recipeId, title: recipe.title ?? "", image: recipe.image ?? "",
            readyInMinutes: recipe.readyInMinutes ?? null, savedAt: new Date().toISOString() }]
    );
  
    try {
      await fetch(`${API_BASE_URL}/recipes/save`, {
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
    } catch {
      // rollback both on failure
      setSavedRecipeIds((curr) =>
        isCurrentlySaved ? [...curr, recipeId] : curr.filter((id) => id !== recipeId)
      );
      setSavedRecipes((curr) =>
        curr.some((r) => Number(r.recipeId) === recipeId)
          ? curr.filter((r) => Number(r.recipeId) !== recipeId)
          : [...curr, {
              recipeId,
              title: recipe.title ?? "",
              image: recipe.image ?? "",
              readyInMinutes: recipe.readyInMinutes ?? null,
              savedAt: new Date().toISOString(),
            }]
      );
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
      </div>
    );
  }

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
            />
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

          {activePage === "collections" && (
            <CollectionsPage
              savedRecipes={savedRecipes}
              cookedRecipes={cookedRecipes}
              onToggleSaved={toggleSavedRecipe}
              onResetCooked={resetCookedRecipes}
              resettingCooked={resettingCookedHistory}
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
            onClick={() => handlePageChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
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
        formatRequestError(err, "Could not sign in. Check your credentials."),
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

        {error ? <p className="error-text">{error}</p> : null}

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

        {error ? <p className="error-text">{error}</p> : null}

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
  onToggleSaved,
}) {
  const [inputValue, setInputValue] = useState("");
  const [manualIngredients, setManualIngredients] = useState([]);
  const [queryText, setQueryText] = useState("");
  const [maxTimeMinutes, setMaxTimeMinutes] = useState("");
  const [rankingMode, setRankingMode] = useState("missing");
  const [visibleChars, setVisibleChars] = useState(0);
  const [showInteraction, setShowInteraction] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [recipes, setRecipes] = useState([]);
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
      });

      if (ingredients) {
        query.set("ingredients", ingredients);
      }

      if (trimmedQuery) {
        query.set("query", trimmedQuery);
      }

      if (maxTimeMinutes) {
        query.set("maxTime", maxTimeMinutes);
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
    setError("");
    setApiError("");
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
          <p className="home-kicker">Home</p>
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
            Cook with what is already in your kitchen.
          </p>
          <p className="search-subtitle home-search-subtitle">
            Add ingredients or describe the meal you want.
          </p>

          <div className="home-hero-pills">
            <span className="home-hero-pill">
              {manualIngredients.length} picked
            </span>
          </div>
        </div>

        <div className="home-hero-art" aria-hidden="true">
          <div className="home-hero-art-glow" />
          <CookingPanIcon className="home-pan-icon" />
        </div>
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
          <h3 className="initial-search-title">Start with ingredients</h3>
          <p className="search-subtitle">Build a quick list, then search.</p>

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
                placeholder="Type an ingredient and press Enter"
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
              <p className="field-hint">Press Enter to add each ingredient.</p>
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

            <label htmlFor="maxTimeInput">Max time</label>
            <input
              type="number"
              id="maxTimeInput"
              className="time-input-compact"
              min="1"
              max="300"
              placeholder="Optional"
              value={maxTimeMinutes}
              onChange={(event) => setMaxTimeMinutes(event.target.value)}
            />

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
                Fewest missing ingredients
              </button>
              <button
                type="button"
                className={`ranking-pill ${
                  rankingMode === "used" ? "active" : ""
                }`}
                onClick={() => setRankingMode("used")}
              >
                Most used ingredients
              </button>
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
            <p id="output">Your suggestions will appear here.</p>
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

function RecipeDetailsPage({
  recipe,
  userId,
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
          <ul className="recipe-detail-list">
            {(details.extendedIngredients || []).map((ingredient, index) => (
              <li key={ingredient.id ?? `${ingredient.name}-${index}`}>
                {ingredient.original ||
                  ingredient.originalName ||
                  ingredient.name}
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

function PantryPage({
  userId,
  initialPantryItems,
  recentlyAdded,
  recipeTitle,
  lastCookedRecipe,
  cookedRecipes,
  onGoHome,
}) {
  const [pantryItems, setPantryItems] = useState(initialPantryItems || []);
  const [loading, setLoading] = useState(
    (initialPantryItems || []).length === 0,
  );
  const [error, setError] = useState("");
  const recentItemKeys = useMemo(
    () =>
      new Set(
        (recentlyAdded || [])
          .map((item) => item?.trim().toLowerCase())
          .filter(Boolean),
      ),
    [recentlyAdded],
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
            <span className="profile-inline-count">{cookedRecipes.length}</span>
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
            <span className="profile-inline-count">
              {displayPantryItems.length}
            </span>
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

function ProfilePage({
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
  }, [pantryItems, settings.quickRecipes, userId]);

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
      <p className="sync-line">{syncMessage}</p>

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

          {ideasLoading ? <p className="sync-line">Finding ideas...</p> : null}
          {ideasError ? <p className="error-text">{ideasError}</p> : null}

          {!ideasLoading && !ideasError && pantryItems.length === 0 ? (
            <p className="sync-line">Cook once to unlock this.</p>
          ) : null}

          {!ideasLoading && !ideasError && pantryItems.length > 0 ? (
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

function SettingsPage({ settings, setSettings, onSave, syncMessage, saving }) {
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
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

function CollectionsPage({ savedRecipes = [], cookedRecipes = [], onToggleSaved, onResetCooked, resettingCooked }) {
  const [activeTab, setActiveTab] = useState("favorites");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const items = activeTab === "favorites" ? savedRecipes : cookedRecipes;
  const dateKey = activeTab === "favorites" ? "savedAt" : "cookedAt";

  function formatDate(iso) {
    if (!iso) return "Recently";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function groupByDate(list, key) {
    return list.reduce((groups, item) => {
      const label = formatDate(item[key]);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
      return groups;
    }, {});
  }

  const grouped = groupByDate(items, dateKey);

  return (
    <>
      <h2 className="section-title">Collection</h2>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border, #e5e5e5)", marginBottom: "1.5rem" }}>
        {[
          { id: "favorites", label: "Saved", count: savedRecipes.length },
          { id: "history",   label: "History", count: cookedRecipes.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="nav-btn"
            style={{
              borderBottom: "none",
              borderRadius: 6,
              padding: "6px 12px",
              fontWeight: 600,
              background: activeTab === tab.id ? "#ffffff" : "transparent",
              color: activeTab === tab.id ? "#000000" : "inherit",
              boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
            onClick={() => { setActiveTab(tab.id); setShowClearConfirm(false); }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.5 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* History toolbar */}
      {activeTab === "history" && cookedRecipes.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          {!showClearConfirm ? (
            <button type="button" className="nav-btn" onClick={() => setShowClearConfirm(true)}>
              Clear history
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.6 }}>Are you sure?</span>
              <button
                type="button"
                className="nav-btn"
                disabled={resettingCooked}
                onClick={async () => { await onResetCooked(); setShowClearConfirm(false); }}
              >
                {resettingCooked ? "Clearing…" : "Yes, clear"}
              </button>
              <button type="button" className="nav-btn" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", opacity: 0.45 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            {activeTab === "favorites" ? "No saved recipes yet" : "No cooking history yet"}
          </p>
          <p style={{ fontSize: 13 }}>
            {activeTab === "favorites"
              ? "Tap the bookmark on any recipe to save it here."
              : "Cook a recipe to start tracking your history."}
          </p>
        </div>
      )}

      {/* Recipe grid grouped by date */}
      {Object.entries(grouped).map(([label, group]) => (
        <div key={label} style={{ marginBottom: "1.75rem" }}>
          <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            {label}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
            {group.map((recipe) => (
              <div
                key={`${recipe.recipeId}-${recipe[dateKey]}`}
                className="card"
                style={{ padding: 0, overflow: "hidden", position: "relative" }}
              >
                {recipe.image ? (
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <div style={{ width: "100%", height: 110, background: "var(--surface, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 28 }}>
                    🍽
                  </div>
                )}
                <div style={{ padding: "10px 12px" }}>
                  <p style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginBottom: 4,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {recipe.title}
                  </p>
                  {recipe.readyInMinutes && (
                    <span style={{ fontSize: 11, opacity: 0.5 }}>{recipe.readyInMinutes} min</span>
                  )}
                </div>

                {/* Unsave button — favorites tab only */}
                {activeTab === "favorites" && (
                  <button
                    type="button"
                    title="Remove from saved"
                    onClick={() => onToggleSaved(recipe)}
                    style={{
                      position: "absolute", top: 7, right: 7,
                      width: 26, height: 26, borderRadius: "50%",
                      background: "rgba(0,0,0,0.45)", border: "none",
                      cursor: "pointer", color: "#ff6b6b", fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ♥
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function CursorAura() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
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
