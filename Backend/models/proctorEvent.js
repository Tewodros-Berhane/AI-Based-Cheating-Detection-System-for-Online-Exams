var mongoose = require("mongoose");
var proctorEventSchema = require("../schemas/proctorEvent");

var ProctorEventModel = mongoose.models.ProctorEventModel || mongoose.model('ProctorEventModel', proctorEventSchema);
module.exports = ProctorEventModel;
