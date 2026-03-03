const app = require("./app");
const env = require("./config/env");
const { verifySupabaseConnection } = require("./services/supabase/connectionService");

app.listen(env.port, async () => {
  console.log(`[startup] Backend listening on http://localhost:${env.port}`);
  await verifySupabaseConnection();
});
