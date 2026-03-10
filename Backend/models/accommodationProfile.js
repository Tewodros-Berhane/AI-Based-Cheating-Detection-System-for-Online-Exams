var mongoose = require("mongoose");
var accommodationProfileSchema = require("../schemas/accommodationProfile");

var AccommodationProfileModel = mongoose.models.AccommodationProfileModel || mongoose.model('AccommodationProfileModel', accommodationProfileSchema);
module.exports = AccommodationProfileModel;
