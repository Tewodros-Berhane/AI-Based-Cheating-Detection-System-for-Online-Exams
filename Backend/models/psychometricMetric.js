var mongoose = require("mongoose");
var psychometricMetricSchema = require("../schemas/psychometricMetric");

var PsychometricMetricModel = mongoose.model('PsychometricMetricModel', psychometricMetricSchema);
module.exports = PsychometricMetricModel;