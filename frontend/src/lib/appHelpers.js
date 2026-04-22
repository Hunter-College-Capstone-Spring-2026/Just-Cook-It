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

export function mergeProfile(base, incoming) {
  return {
    ...base,
    ...incoming,
    dietary: {
      ...base.dietary,
      ...(incoming?.dietary || {}),
    },
  };
}

export function mergeIngredientLists(base, incoming) {
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

export function formatRequestError(error, fallbackMessage) {
  const message = error?.message || "";
  if (message === "Load failed" || message === "Failed to fetch") {
    return "Could not connect to backend API. Start backend on http://localhost:4000.";
  }
  return message || fallbackMessage;
}

export function buildGuideSteps(recipeDetails) {
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

export function normalizeCookedRecipe(recipe) {
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

export function mergeCookedRecipes(base, incoming) {
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

export function normalizeSavedRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return null;

  const recipeId = Number(recipe.recipeId ?? recipe.id);
  const title = cleanText(recipe.title ?? recipe.recipeName);
  if (!Number.isFinite(recipeId) || !title) return null;

  const readyInMinutes = Number.isFinite(
    Number(recipe.readyInMinutes ?? recipe.readyTime),
  )
    ? Number(recipe.readyInMinutes ?? recipe.readyTime)
    : null;

  return {
    recipeId,
    title,
    image: cleanText(recipe.image ?? recipe.imageUrl),
    readyInMinutes,
    cuisines: normalizeStringList(recipe.cuisines),
    dishTypes: normalizeStringList(recipe.dishTypes),
    ingredients: normalizeStringList(recipe.ingredients ?? recipe.allIngredients),
    savedAt: cleanText(recipe.savedAt) || new Date().toISOString(),
  };
}

export function mergeSavedRecipes(base, incoming) {
  const combined = [...(incoming || []), ...(base || [])]
    .map((recipe) => normalizeSavedRecipe(recipe))
    .filter(Boolean);

  const deduped = new Map();
  combined.forEach((recipe) => {
    if (!deduped.has(recipe.recipeId)) {
      deduped.set(recipe.recipeId, recipe);
    }
  });

  return Array.from(deduped.values()).sort(
    (left, right) =>
      new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
  );
}

export function buildRecipePreview(recipe) {
  const normalized = normalizeSavedRecipe(recipe);
  if (!normalized) return null;

  return {
    id: normalized.recipeId,
    title: normalized.title,
    imageUrl: normalized.image,
    readyTime: normalized.readyInMinutes,
    cuisines: normalized.cuisines,
    dishTypes: normalized.dishTypes,
  };
}

export function inferRecipeCuisines(recipe) {
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

export function analyzeCookedRecipes(recipes) {
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

export function formatCookedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getNotificationPermissionState() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission() {
  const currentState = getNotificationPermissionState();
  if (currentState === "unsupported" || currentState !== "default") {
    return currentState;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return getNotificationPermissionState();
  }
}

export function sendBrowserNotification(title, options = {}) {
  if (getNotificationPermissionState() !== "granted") return false;

  try {
    const notification = new Notification(title, options);
    const closeAfterMs =
      typeof options.closeAfterMs === "number" ? options.closeAfterMs : 4500;
    window.setTimeout(() => notification.close(), closeAfterMs);
    return true;
  } catch {
    return false;
  }
}

function formatMeasureValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return cleanText(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: numericValue < 10 ? 2 : 1,
  }).format(numericValue);
}

function formatIngredientMeasure(measure) {
  if (!measure) return "";

  const amountLabel = formatMeasureValue(measure.amount);
  const unitLabel = cleanText(
    measure.unitShort || measure.unitLong || measure.unit,
  );

  return [amountLabel, unitLabel].filter(Boolean).join(" ").trim();
}

export function formatIngredientForUnits(ingredient, units = "metric") {
  if (!ingredient || typeof ingredient !== "object") return "";

  const preferredMeasure =
    units === "imperial" ? ingredient?.measures?.us : ingredient?.measures?.metric;
  const fallbackMeasure =
    ingredient?.measures?.metric || ingredient?.measures?.us || null;
  const measureLabel = formatIngredientMeasure(preferredMeasure || fallbackMeasure);
  const ingredientName = cleanText(ingredient.originalName || ingredient.name);

  if (measureLabel && ingredientName) {
    return `${measureLabel} ${ingredientName}`.trim();
  }

  return cleanText(ingredient.original || ingredient.originalName || ingredient.name);
}
