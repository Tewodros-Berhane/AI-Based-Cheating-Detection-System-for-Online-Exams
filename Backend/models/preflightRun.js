var mongoose = require("mongoose");
var preflightRunSchema = require("../schemas/preflightRun");

var PreflightRunModel = mongoose.model("PreflightRunModel", preflightRunSchema);
module.exports = PreflightRunModel;
