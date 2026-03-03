const axios = require("axios");
const env = require("./env");

const spoonacularClient = axios.create({
  baseURL: env.spoonacularBaseUrl,
  timeout: 10000
});

module.exports = { spoonacularClient };
