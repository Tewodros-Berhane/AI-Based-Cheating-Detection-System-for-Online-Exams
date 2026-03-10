var mongoose = require("mongoose");
var moderationActionSchema = require("../schemas/moderationAction");

var ModerationActionModel = mongoose.models.ModerationActionModel || mongoose.model('ModerationActionModel', moderationActionSchema);
module.exports = ModerationActionModel;
