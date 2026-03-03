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

function App() {
  const [activePage, setActivePage] = useState("home");
  const [profile, setProfile] = useLocalStorage("jci_profile", defaultProfile);
  const [settings, setSettings] = useLocalStorage("jci_settings", defaultSettings);

  const navItems = [
    { id: "home", label: "Home" },
    { id: "profile", label: "Profile" },
    { id: "settings", label: "Settings" }
  ];

  return (
    <>
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
        {activePage === "home" && <HomePage profile={profile} settings={settings} />}
        {activePage === "profile" && <ProfilePage profile={profile} setProfile={setProfile} />}
        {activePage === "settings" && <SettingsPage settings={settings} setSettings={setSettings} />}
      </main>
    </>
  );
}

function HomePage({ profile, settings }) {
  const [inputValue, setInputValue] = useState("");
  const [showNudge, setShowNudge] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [showInteraction, setShowInteraction] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [recipes, setRecipes] = useState([]);

  const welcomeText = "Welcome!";
  const characters = useMemo(() => welcomeText.split(""), [welcomeText]);

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
      const response = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients,
          preferences: {
            vegetarian: profile.dietary.vegetarian,
            vegan: profile.dietary.vegan,
            quickRecipes: settings.quickRecipes
          }
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to fetch recipe ideas right now.");
      }

      setRecipes(payload.recipes || []);
    } catch (requestError) {
      setApiError(requestError.message || "Could not connect to backend API.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 id="welcome" className="welcome-text" aria-label="Welcome">
        {characters.slice(0, visibleChars).map((char, index) => (
          <span key={`${char}-${index}`}>{char === " " ? "\u00A0" : char}</span>
        ))}
      </h2>

      <section id="interaction" aria-live="polite" className={showInteraction ? "show" : ""}>
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
        />

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
              <li key={recipe.id} className="recipe-card">
                <p className="recipe-title">{recipe.title}</p>
                <p>
                  {recipe.cookTimeMinutes} min | Matches: {recipe.matchCount}
                </p>
                <p>
                  Missing: {recipe.missingIngredients.length ? recipe.missingIngredients.join(", ") : "None"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </>
  );
}

function ProfilePage({ profile, setProfile }) {
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
      <h2>Your Profile</h2>

      <section className="card">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={profile.email}
          onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
        />
      </section>

      <section className="card">
        <h3>Dietary Preferences & Restrictions</h3>

        <label>
          <input
            type="checkbox"
            checked={profile.dietary.vegetarian}
            onChange={() => updateDietary("vegetarian")}
          />
          Vegetarian
        </label>
        <label>
          <input type="checkbox" checked={profile.dietary.vegan} onChange={() => updateDietary("vegan")} />
          Vegan
        </label>
        <label>
          <input type="checkbox" checked={profile.dietary.halal} onChange={() => updateDietary("halal")} />
          Halal
        </label>
        <label>
          <input
            type="checkbox"
            checked={profile.dietary.glutenFree}
            onChange={() => updateDietary("glutenFree")}
          />
          Gluten-Free
        </label>

        <textarea
          placeholder="Allergies or notes (e.g. no peanuts, lactose intolerant)"
          value={profile.notes}
          onChange={(event) => setProfile((current) => ({ ...current, notes: event.target.value }))}
        />
      </section>

      <section className="card">
        <h3>Weekly Cooking Time</h3>

        {WEEK_DAYS.map((day) => (
          <div key={day} className="day-time">
            <label htmlFor={`time-${day}`}>{day}</label>
            <input
              id={`time-${day}`}
              type="number"
              min="0"
              placeholder="Minutes"
              value={profile.weeklyTime[day]}
              onChange={(event) => updateDayTime(day, event.target.value)}
            />
          </div>
        ))}
      </section>
    </>
  );
}

function SettingsPage({ settings, setSettings }) {
  return (
    <>
      <h2>Settings</h2>

      <section className="card">
        <label>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={() => setSettings((current) => ({ ...current, notifications: !current.notifications }))}
          />
          Enable notifications
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.quickRecipes}
            onChange={() => setSettings((current) => ({ ...current, quickRecipes: !current.quickRecipes }))}
          />
          Show quick recipes first
        </label>

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
    </>
  );
}

export default App;
