const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const requiredEnv = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SPOONACULAR_API_KEY"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.warn(
    `[env] Missing environment variables: ${missingEnv.join(", ")}. ` +
      "Some features may fail until .env is configured."
  );
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  spoonacularApiKey: process.env.SPOONACULAR_API_KEY || "",
  spoonacularBaseUrl: process.env.SPOONACULAR_BASE_URL || "https://api.spoonacular.com"
};
