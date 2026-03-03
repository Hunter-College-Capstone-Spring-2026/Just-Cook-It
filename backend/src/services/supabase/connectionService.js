const { TABLES } = require("./schema");
const { getRows } = require("./dbService");

async function verifySupabaseConnection() {
  try {
    await getRows(TABLES.USER, {
      columns: "user_id",
      limit: 1
    });

    console.log("[startup] Supabase connection check passed (table access confirmed).");
    return { ok: true };
  } catch (error) {
    console.error("[startup] Supabase connection check failed:", error.message);
    return {
      ok: false,
      error: error.message
    };
  }
}

module.exports = {
  verifySupabaseConnection
};
