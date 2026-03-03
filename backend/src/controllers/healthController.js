function getHealth(_req, res) {
  res.json({
    ok: true,
    service: "just-cook-it-backend",
    timestamp: new Date().toISOString()
  });
}

module.exports = { getHealth };
