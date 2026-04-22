export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export const defaultProfile = {
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

export const defaultSettings = {
  notifications: false,
  quickRecipes: true,
  units: "metric",
  smartSuggestions: true,
  autoStartGuide: false,
  ingredientInsights: true,
};
