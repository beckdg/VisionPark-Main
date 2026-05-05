const express = require("express");
const chapaRoutes = require("./chapa/chapa.routes");

const router = express.Router();

router.use("/chapa", chapaRoutes);

module.exports = router;
