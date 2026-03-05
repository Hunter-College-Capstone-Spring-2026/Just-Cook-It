import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";


const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

const defaultProfile = {
  email: "user@email.com",
  name: "Cook It User",
  dietary: {
    vegetarian: false,
    vegan: false,
    halal: false,
    glutenFree: false
  },
  notes: "",
  weeklyTime: {
    Monday: "",
    Tuesday: "",
    Wednesday: "",
    Thursday: "",
    Friday: "",
    Saturday: "",
    Sunday: ""
  }
};

const defaultSettings = {
  notifications: true,
  quickRecipes: true,
  units: "metric"
};

const SUPPORTIVE_LINES = [
  "You are doing a lot. Let's make this one thing easy.",
  "No pressure. We can find something simple in under a minute.",
  "You showed up. That's enough for today. We'll handle the recipe part.",
  "Take one breath. Type what you have, and we will do the heavy lifting."
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
    },
    weeklyTime: {
      ...base.weeklyTime,
      ...(incoming?.weeklyTime || {})
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
          {activePage === "home" && <HomePage settings={settings} />}
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

function HomePage({ settings }) {
  const [inputValue, setInputValue] = useState("");
  const [showNudge, setShowNudge] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [showInteraction, setShowInteraction] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [commitmentName, setCommitmentName] = useState("");
  const [commitmentPosted, setCommitmentPosted] = useState(false);
  const [rewardUnlockedToday, setRewardUnlockedToday] = useState(false);

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
    selectedRecipeId.length > 0
  ].filter(Boolean).length;
  const progressPercent = Math.round((progressStepsDone / 3) * 100);

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

  const searchRecipes = async () => {
    const ingredients = inputValue.trim();

    if (!ingredients) {
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
        number: settings.quickRecipes ? "5" : "10",
        ranking: "1",
        ignorePantry: "true"
      });
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

      setRecipes(mappedRecipes);
      setSelectedRecipeId("");
    } catch (requestError) {
      setApiError(requestError.message || "Could not connect to backend API.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const applyIngredientSuggestion = (value) => {
    setInputValue((current) => (current ? `${current}, ${value}` : value));
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
        <div className="pressure-banner">
          <p>{supportiveMessage}</p>
        </div>
        <section className="fogg-panel gradient-card">
          <h4>Your next win</h4>
          <p>
            Motivation: protect your energy now, and your future time later. Ability: use one ingredient if needed.
            Prompt: press <strong>Cook it!</strong> now.
          </p>
          <div className="progress-strip" aria-label="Task progress">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="progress-copy">Progress: {progressStepsDone}/3 actions complete</p>
        </section>
        <h3>What do you have in your kitchen?</h3>
        <label className="sr-only" htmlFor="userInput">
          Ingredients
        </label>
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

        <div className="quick-ingredients" aria-label="Quick ingredient suggestions">
          {quickSets.map((item) => (
            <button key={item} type="button" className="chip-btn" onClick={() => applyIngredientSuggestion(item)}>
              + {item}
            </button>
          ))}
        </div>

        <div id="nudge" className={`nudge ${showNudge ? "show" : "hidden"}`}>
          Not sure where to start? Try one ingredient.
        </div>

        <button id="actionBtn" type="button" onClick={searchRecipes} disabled={loading}>
          {loading ? "Finding recipes..." : "Cook it!"}
        </button>

        {error ? <p className="error-text">{error}</p> : null}
        {apiError ? <p className="error-text">{apiError}</p> : null}

        <section className="results" aria-live="polite">
          <h4>Recipe ideas</h4>
          {!loading && recipes.length === 0 && !error && !apiError ? (
            <p id="output">Your suggestions will appear here.</p>
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
                <button type="button" className="plan-btn" onClick={() => completeRecipePlan(recipe.id)}>
                  {selectedRecipeId === recipe.id ? "Planned" : "I'll cook this"}
                </button>
              </li>
            ))}
          </ul>

          {selectedRecipeId ? (
            <section className="completion-panel gradient-card" aria-live="polite">
              <h4>Plan locked in</h4>
              <p>
                Great call. You completed a high-pressure decision. This helps tonight and reduces tomorrow's stress
                too.
              </p>
              {rewardUnlockedToday ? (
                <p className="reward-line">Scarce reward unlocked: Golden Ladle token for today.</p>
              ) : (
                <p className="reward-line">Today's scarce reward already claimed. Keep your streak tomorrow.</p>
              )}

              <div className="commitment-box">
                <label htmlFor="commitmentName">Who are you making this for?</label>
                <input
                  id="commitmentName"
                  type="text"
                  placeholder="friend, sibling, roommate..."
                  value={commitmentName}
                  onChange={(event) => {
                    setCommitmentName(event.target.value);
                    setCommitmentPosted(false);
                  }}
                />
                <button type="button" onClick={postCommitment}>
                  Commit
                </button>
                {commitmentPosted ? (
                  <p className="commitment-line">Commitment posted: You will cook for {commitmentName} tonight.</p>
                ) : null}
              </div>

              <div className="survey-box">
                <p>How supported did you feel by this flow?</p>
                <div className="survey-actions">
                  {["Too busy", "Okay", "Very supported"].map((option) => (
                    <button key={option} type="button" onClick={() => setFeedback(option)}>
                      {option}
                    </button>
                  ))}
                </div>
                {feedback ? <p className="feedback-line">Thanks. Feedback saved: {feedback}</p> : null}
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

  const updateDayTime = (day, value) => {
    setProfile((current) => ({
      ...current,
      weeklyTime: {
        ...current.weeklyTime,
        [day]: value
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

      <section className="card gradient-card profile-card">
        <h3>Weekly Cooking Time</h3>

        {WEEK_DAYS.map((day) => (
          <div key={day} className="day-time interactive-row">
            <label htmlFor={`time-${day}`}>{day}</label>
            <input
              id={`time-${day}`}
              type="number"
              min="0"
              max="480"
              placeholder="Minutes"
              value={profile.weeklyTime[day]}
              onChange={(event) => updateDayTime(day, event.target.value)}
            />
          </div>
        ))}
      </section>

      <button className="save-btn" type="button" onClick={onSave} disabled={saving}>
        {saving ? "Saving profile..." : "Save Profile"}
      </button>
    </>
  );
}

function SettingsPage({ settings, setSettings, onSave, syncMessage, saving }) {
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
            onClick={() => setSettings((current) => ({ ...current, notifications: !current.notifications }))}
          >
            {settings.notifications ? "On" : "Off"}
          </button>
        </div>

        <div className="interactive-row">
          <span>Show quick recipes first</span>
          <button
            type="button"
            className={`toggle-switch ${settings.quickRecipes ? "on" : ""}`}
            onClick={() => setSettings((current) => ({ ...current, quickRecipes: !current.quickRecipes }))}
          >
            {settings.quickRecipes ? "On" : "Off"}
          </button>
        </div>

        <label htmlFor="units">Units</label>
        <select
          id="units"
          value={settings.units}
          onChange={(event) => setSettings((current) => ({ ...current, units: event.target.value }))}
        >
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
        </select>
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