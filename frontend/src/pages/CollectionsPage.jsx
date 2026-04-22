import { useState } from "react";

export default function CollectionsPage({
  savedRecipes = [],
  cookedRecipes = [],
  onToggleSaved,
  onResetCooked,
  resettingCooked,
}) {
  const [activeTab, setActiveTab] = useState("favorites");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const items = activeTab === "favorites" ? savedRecipes : cookedRecipes;
  const dateKey = activeTab === "favorites" ? "savedAt" : "cookedAt";

  function formatDate(iso) {
    if (!iso) return "Recently";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border, #e5e5e5)",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { id: "favorites", label: "Saved", count: savedRecipes.length },
          { id: "history", label: "History", count: cookedRecipes.length },
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
              boxShadow:
                activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
            onClick={() => {
              setActiveTab(tab.id);
              setShowClearConfirm(false);
            }}
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

      {activeTab === "history" && cookedRecipes.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "1rem",
          }}
        >
          {!showClearConfirm ? (
            <button
              type="button"
              className="nav-btn"
              onClick={() => setShowClearConfirm(true)}
            >
              Clear history
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.6 }}>Are you sure?</span>
              <button
                type="button"
                className="nav-btn"
                disabled={resettingCooked}
                onClick={async () => {
                  await onResetCooked();
                  setShowClearConfirm(false);
                }}
              >
                {resettingCooked ? "Clearing…" : "Yes, clear"}
              </button>
              <button
                type="button"
                className="nav-btn"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", opacity: 0.45 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            {activeTab === "favorites"
              ? "No saved recipes yet"
              : "No cooking history yet"}
          </p>
          <p style={{ fontSize: 13 }}>
            {activeTab === "favorites"
              ? "Tap the bookmark on any recipe to save it here."
              : "Cook a recipe to start tracking your history."}
          </p>
        </div>
      )}

      {Object.entries(grouped).map(([label, group]) => (
        <div key={label} style={{ marginBottom: "1.75rem" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              opacity: 0.4,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "0.75rem",
            }}
          >
            {label}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
              gap: 12,
            }}
          >
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
                    style={{
                      width: "100%",
                      height: 110,
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 110,
                      background: "var(--surface, #f5f5f5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.4,
                      fontSize: 28,
                    }}
                  >
                    🍽
                  </div>
                )}
                <div style={{ padding: "10px 12px" }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1.35,
                      marginBottom: 4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {recipe.title}
                  </p>
                  {recipe.readyInMinutes && (
                    <span style={{ fontSize: 11, opacity: 0.5 }}>
                      {recipe.readyInMinutes} min
                    </span>
                  )}
                </div>

                {activeTab === "favorites" && (
                  <button
                    type="button"
                    title="Remove from saved"
                    onClick={() => onToggleSaved(recipe)}
                    style={{
                      position: "absolute",
                      top: 7,
                      right: 7,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.45)",
                      border: "none",
                      cursor: "pointer",
                      color: "#ff6b6b",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
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
