var mongoose = require("mongoose");
var config = require('config');
let tool = require("./tool")

const originalExec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.exec = function execCompat(...args) {
  const callback = args[args.length - 1];
  if (typeof callback === 'function') {
    const execArgs = args.slice(0, -1);
    const promise = originalExec.apply(this, execArgs);
    promise.then((result) => callback(null, result)).catch((error) => callback(error));
    return promise;
  }
  return originalExec.apply(this, args);
};

//database connection
mongoose.Promise = global.Promise;
const options = {
  autoIndex: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000
};

mongoose.connect(config.get('mongodb.connectionString'),options).then(()=>{
    console.log("connected to mongoDB");
    //tool.createadmin();
}).catch((err)=>{
    console.log("Error connecting to database",err);
})


module.exports=mongoose;
