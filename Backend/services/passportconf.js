var passport = require("passport");
var LocalStrategy = require("passport-local").Strategy;
const bcrypt = require('bcryptjs');
const saltRounds = 10;
var config = require("config");
var JwtStrategy = require('passport-jwt').Strategy,
    ExtractJwt = require('passport-jwt').ExtractJwt;
var UserModel =  require("../models/user");



//user login local strategy
passport.use('login',new LocalStrategy({
  usernameField: 'emailid',
  passwordField : 'password',
  passReqToCallback : true 
  },
  async function(req,emailid, password, done) {
    try {
      const user = await UserModel.findOne({ 'emailid' : emailid, 'status' : true });
      if (!user) {
        return done(null, false,{
          success: false,
          message: "Invalid emailid"
        });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) {
        return done(null, user,{
          success: true,
          message: "logged in successfully"
        });
      }

      return done(null, false,{
        success: false,
        message: "Invalid Password"
      });
    } catch (err) {
      return done(err,false,{
        success: false,
        message: "Server Error"
      });
    }
  }
));




//options jwt
var opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = config.get('jwt.secret');

passport.use('user-token',new JwtStrategy(opts, async function(jwt_payload, done) {
  try {
    const user = await UserModel.findById(jwt_payload._id);
    if (user) {
      return done(null, user,{
        success: true,
        message: "Successfull"
      });
    }

    return done(null, false,{
      success: false,
      message: "Authentication Failed"
    });
  } catch (err) {
    return done(err, false,{
      success: false,
      message: "Server Error"
    });
  }
}));




module.exports = passport
