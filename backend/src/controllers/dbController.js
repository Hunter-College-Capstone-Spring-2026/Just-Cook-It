const { getRows, insertRows, updateRows } = require("../services/supabase/dbService");
const {
  TABLES,
  TABLE_COMMENTS,
  TABLE_RELATIONSHIPS,
  SCHEMA_DEFINITION
} = require("../services/supabase/schema");

const TABLE_LOOKUP = Object.fromEntries(
  Object.values(TABLES).map((tableName) => [tableName.toLowerCase(), tableName])
);

function resolveTable(tableName) {
  return TABLE_LOOKUP[String(tableName || "").toLowerCase()];
}

function assertAllowedTable(tableName) {
  const resolved = resolveTable(tableName);

  if (!resolved) {
    const error = new Error(`Unsupported table: ${tableName}`);
    error.statusCode = 400;
    throw error;
  }

  return resolved;
}

async function getSchemaMetadata(_req, res) {
  res.status(200).json({
    tables: TABLES,
    comments: TABLE_COMMENTS,
    relationships: TABLE_RELATIONSHIPS,
    schema: SCHEMA_DEFINITION
  });
}

async function getTableRows(req, res) {
  const table = assertAllowedTable(req.params.tableName);
  const { limit, orderBy, ascending, ...filters } = req.query;

  const rows = await getRows(table, {
    filters,
    limit: limit ? Number(limit) : undefined,
    orderBy,
    ascending: ascending !== "false"
  });

  res.status(200).json({
    table,
    count: rows.length,
    rows
  });
}

async function createTableRows(req, res) {
  const table = assertAllowedTable(req.params.tableName);
  const payload = req.body;

  if (!payload || (Array.isArray(payload) && payload.length === 0)) {
    const error = new Error("Request body must include row data.");
    error.statusCode = 400;
    throw error;
  }

  const rows = await insertRows(table, payload, {
    single: !Array.isArray(payload)
  });

  res.status(201).json({
    table,
    rows
  });
}

async function updateTableRows(req, res) {
  const table = assertAllowedTable(req.params.tableName);
  const { filters = {}, data } = req.body || {};

  if (!data || Object.keys(data).length === 0) {
    const error = new Error("Request body must include 'data' fields to update.");
    error.statusCode = 400;
    throw error;
  }

  if (!filters || Object.keys(filters).length === 0) {
    const error = new Error("Request body must include 'filters' to scope updates.");
    error.statusCode = 400;
    throw error;
  }

  const rows = await updateRows(table, data, { filters });

  res.status(200).json({
    table,
    count: rows.length,
    rows
  });
}

module.exports = {
  getSchemaMetadata,
  getTableRows,
  createTableRows,
  updateTableRows
};
