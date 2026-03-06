var mongoose = require("mongoose");
var proctorRiskSnapshotSchema = require("../schemas/proctorRiskSnapshot");

var ProctorRiskSnapshotModel = mongoose.models.ProctorRiskSnapshotModel || mongoose.model('ProctorRiskSnapshotModel', proctorRiskSnapshotSchema);
module.exports = ProctorRiskSnapshotModel;
