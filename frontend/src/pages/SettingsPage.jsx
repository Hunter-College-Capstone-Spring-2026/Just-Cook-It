import { useEffect, useState } from "react";

import { API_BASE_URL } from "../lib/appConfig";
import {
  getNotificationPermissionState,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from "../lib/appHelpers";

export default function SettingsPage({
  profile,
  setProfile,
  settings,
  setSettings,
  onSave,
  syncMessage,
  saving,
}) {
  const [restrictions, setRestrictions] = useState([]);
  const [restrictionsLoading, setRestrictionsLoading] = useState(true);
  const [notificationState, setNotificationState] = useState(() =>
    getNotificationPermissionState(),
  );
  const [notificationFeedback, setNotificationFeedback] = useState("");

  const updateSetting = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const toggleSetting = (key) => {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const updateProfile = (key, value) => {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const toggleDietary = (name) => {
    setProfile((current) => ({
      ...current,
      dietary: { ...current.dietary, [name]: !current.dietary[name] },
    }));
  };

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/dietary-restrictions`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setRestrictions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setRestrictions([]);
      })
      .finally(() => {
        if (active) setRestrictionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const currentState = getNotificationPermissionState();
    setNotificationState(currentState);

    if (
      settings.notifications &&
      (currentState === "denied" || currentState === "unsupported")
    ) {
      updateSetting("notifications", false);
    }
  }, []);

  const handleNotificationToggle = async () => {
    if (settings.notifications) {
      updateSetting("notifications", false);
      setNotificationFeedback("Browser notifications paused.");
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    setNotificationState(permission);

    if (permission === "granted") {
      updateSetting("notifications", true);
      setNotificationFeedback(
        "Notifications are on for daily suggestions and cooking updates.",
      );
      sendBrowserNotification("Just Cook It notifications enabled", {
        body: "We’ll let you know when fresh recipe ideas are ready.",
      });
      return;
    }

    updateSetting("notifications", false);

    if (permission === "denied") {
      setNotificationFeedback(
        "Notifications are blocked in your browser. Allow them to turn this on.",
      );
      return;
    }

    if (permission === "unsupported") {
      setNotificationFeedback(
        "This browser does not support notifications on this page.",
      );
      return;
    }

    setNotificationFeedback(
      "Notification permission was dismissed, so notifications stayed off.",
    );
  };

  const notificationStatusLabel = {
    granted: "Allowed",
    denied: "Blocked",
    default: "Ask first",
    unsupported: "Unsupported",
  }[notificationState];

  return (
    <>
      <h2 className="section-title">Settings</h2>
      <p className="sync-line">{syncMessage}</p>

      <section className="card gradient-card settings-card settings-hero-card">
        <div className="settings-hero-top">
          <div>
            <p className="profile-kicker">Kitchen controls</p>
            <h3>Your cooking defaults, tuned once.</h3>
            <p className="sync-line settings-hero-note">
              Notifications, recipe speed, and measurements all update from
              here.
            </p>
          </div>

          <div className="settings-summary-grid">
            <div className="profile-stat-tile">
              <span className="profile-stat-label">Notifications</span>
              <strong>{settings.notifications ? "On" : "Off"}</strong>
              <span className="pantry-count-label">{notificationStatusLabel}</span>
            </div>
            <div className="profile-stat-tile">
              <span className="profile-stat-label">Units</span>
              <strong>
                {settings.units === "imperial" ? "Imperial" : "Metric"}
              </strong>
              <span className="pantry-count-label">Recipe ingredients</span>
            </div>
          </div>
        </div>
      </section>

      <div className="settings-grid">
        <section className="card gradient-card settings-card">
          <div className="settings-card-head">
            <div>
              <p className="profile-kicker">Profile</p>
              <h3>User Information</h3>
            </div>
          </div>

          <div className="setting-group">
            <div className="setting-row setting-row-stack">
              <div className="setting-copy">
                <h4>Name</h4>
              </div>
              <input
                id="settingsName"
                type="text"
                value={profile.name || ""}
                onChange={(event) => updateProfile("name", event.target.value)}
              />
            </div>

            <div className="setting-row setting-row-stack">
              <div className="setting-copy">
                <h4>Email</h4>
              </div>
              <input
                id="settingsEmail"
                type="email"
                value={profile.email || ""}
                onChange={(event) => updateProfile("email", event.target.value)}
              />
            </div>

            <div className="setting-row setting-row-stack">
              <div className="setting-copy">
                <h4>Max cook time preference</h4>
                <p>Optional. Leave blank to remove this preference.</p>
              </div>
              <div className="profile-time-input-row">
                <input
                  id="settingsMaxCookTime"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="30"
                  value={profile.userMaxReadyTime ?? ""}
                  onChange={(event) =>
                    updateProfile(
                      "userMaxReadyTime",
                      event.target.value.replace(/\D/g, "").slice(0, 3),
                    )
                  }
                  onBlur={() => {
                    if (!profile.userMaxReadyTime) return;
                    const boundedMinutes = Math.min(
                      Math.max(Number(profile.userMaxReadyTime), 1),
                      300,
                    );
                    updateProfile("userMaxReadyTime", String(boundedMinutes));
                  }}
                />
                <span className="profile-time-input-unit">minutes</span>
              </div>
            </div>

            <div className="setting-row setting-row-stack">
              <div className="setting-copy">
                <h4>Dietary restrictions</h4>
              </div>
              {restrictionsLoading ? (
                <p className="sync-line">Loading...</p>
              ) : restrictions.length === 0 ? (
                <p className="sync-line">No dietary options found.</p>
              ) : (
                <div className="preference-grid settings-choice-grid">
                  {restrictions.map((restriction) => {
                    const restrictionName = restriction.dietary_restriction_name;
                    return (
                      <button
                        key={restriction.restriction_id}
                        type="button"
                        className={`toggle-tile ${
                          profile.dietary[restrictionName] ? "on" : ""
                        }`}
                        onClick={() => toggleDietary(restrictionName)}
                      >
                        {restrictionName.charAt(0).toUpperCase() +
                          restrictionName.slice(1)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="card gradient-card settings-card">
          <div className="settings-card-head">
            <div>
              <p className="profile-kicker">Experience</p>
              <h3>Everyday preferences</h3>
            </div>
          </div>

          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-copy">
                <h4>Enable notifications</h4>
                <p>
                  Get browser alerts for daily recipe suggestions and when a
                  recipe is marked as cooked.
                </p>
              </div>

              <div className="setting-actions">
                <span className="settings-badge">{notificationStatusLabel}</span>
                {settings.notifications && notificationState === "granted" ? (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() =>
                      sendBrowserNotification("Just Cook It test", {
                        body: "Notifications are working.",
                      })
                    }
                  >
                    Send test
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`toggle-switch ${settings.notifications ? "on" : ""}`}
                  onClick={handleNotificationToggle}
                >
                  {settings.notifications ? "On" : "Off"}
                </button>
              </div>
            </div>

            {notificationFeedback ? (
              <p className="sync-line settings-inline-note">
                {notificationFeedback}
              </p>
            ) : null}

            <div className="setting-row">
              <div className="setting-copy">
                <h4>Show quick recipes first</h4>
                <p>
                  Keep search results and profile suggestions focused on faster
                  meals.
                </p>
              </div>

              <div className="setting-actions">
                <button
                  type="button"
                  className={`toggle-switch ${settings.quickRecipes ? "on" : ""}`}
                  onClick={() => toggleSetting("quickRecipes")}
                >
                  {settings.quickRecipes ? "On" : "Off"}
                </button>
              </div>
            </div>

            <div className="setting-row setting-row-stack">
              <div className="setting-copy">
                <h4>Recipe measurements</h4>
                <p>Choose how ingredient amounts are shown inside recipes.</p>
              </div>

              <div className="preference-grid settings-choice-grid">
                <button
                  type="button"
                  className={`toggle-tile ${
                    settings.units === "metric" ? "on" : ""
                  }`}
                  onClick={() => updateSetting("units", "metric")}
                >
                  Metric
                </button>
                <button
                  type="button"
                  className={`toggle-tile ${
                    settings.units === "imperial" ? "on" : ""
                  }`}
                  onClick={() => updateSetting("units", "imperial")}
                >
                  Imperial
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>

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
