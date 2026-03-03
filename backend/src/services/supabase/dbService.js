const { supabase } = require("../../config/supabaseClient");

function assertSupabaseClient() {
  if (!supabase) {
    const error = new Error("Supabase client is not initialized. Check environment variables.");
    error.statusCode = 500;
    throw error;
  }
}

function applyFilters(query, filters = {}) {
  let nextQuery = query;

  Object.entries(filters).forEach(([column, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    nextQuery = nextQuery.eq(column, value);
  });

  return nextQuery;
}

async function getRows(table, options = {}) {
  assertSupabaseClient();

  const {
    columns = "*",
    filters = {},
    limit,
    orderBy,
    ascending = true,
    single = false
  } = options;

  let query = supabase.from(table).select(columns);
  query = applyFilters(query, filters);

  if (orderBy) {
    query = query.order(orderBy, { ascending });
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (single) {
    query = query.maybeSingle();
  }

  const { data, error } = await query;

  if (error) {
    error.statusCode = 500;
    throw error;
  }

  return data;
}

async function insertRows(table, payload, options = {}) {
  assertSupabaseClient();

  const { columns = "*", single = false } = options;

  let query = supabase.from(table).insert(payload).select(columns);

  if (single) {
    query = query.single();
  }

  const { data, error } = await query;

  if (error) {
    error.statusCode = 500;
    throw error;
  }

  return data;
}

async function updateRows(table, payload, options = {}) {
  assertSupabaseClient();

  const { filters = {}, columns = "*", single = false } = options;

  let query = supabase.from(table).update(payload);
  query = applyFilters(query, filters).select(columns);

  if (single) {
    query = query.single();
  }

  const { data, error } = await query;

  if (error) {
    error.statusCode = 500;
    throw error;
  }

  return data;
}

module.exports = {
  getRows,
  insertRows,
  updateRows
};
