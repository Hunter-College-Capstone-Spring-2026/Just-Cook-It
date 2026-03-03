const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  getSchemaMetadata,
  getTableRows,
  createTableRows,
  updateTableRows
} = require("../controllers/dbController");

const router = express.Router();

router.get("/schema", asyncHandler(getSchemaMetadata));
router.get("/:tableName", asyncHandler(getTableRows));
router.post("/:tableName", asyncHandler(createTableRows));
router.patch("/:tableName", asyncHandler(updateTableRows));

module.exports = router;
