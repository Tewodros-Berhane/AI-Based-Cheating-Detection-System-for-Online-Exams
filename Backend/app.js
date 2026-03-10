const PORT = process.env.PORT || 5001
var createError = require('http-errors');
var express = require('express');
const helmet = require('helmet')
const cors = require('cors');
var path = require('path');
var morgan = require('morgan');
var config = require('config');
var bodyParser = require('body-parser');
const validatorCompat = require('./services/validatorCompat');
var passport = require("./services/passportconf");
var tool = require("./services/tool");
var appLogger = require("./services/logger");
var metrics = require("./services/metrics");
var sendFailureAlert = require("./services/alerts").sendFailureAlert;
var app = express();


app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));
app.options(/.*/, cors());

app.use(validatorCompat);
var mongoose = require("./services/connection");
var admin = require("./routes/admin");
var login = require("./routes/login");
var user = require("./routes/user");
const dashboardRoutes = require('./routes/dashboard');
var universal = require("./routes/universal");
var question = require("./routes/questions");
var testpaper = require("./routes/testpaper");
var up = require("./routes/fileUpload");
var trainee = require("./routes/trainee");
var stopRegistration = require("./routes/stopRegistration");
var results = require("./routes/results");
var dummy = require("./routes/dummy");
const { upload, router: fileUploadRouter } = require('./routes/fileUpload');


app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));




//configs
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev', {
    stream: {
        write: (line) => appLogger.info('http_access', { line: line.trim() })
    }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(metrics.httpMetricsMiddleware);



//passport
app.use(passport.initialize());


//bind routes
app.get('/api/v1/system/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        uptime: process.uptime()
    });
});

app.get('/api/v1/system/metrics', (req, res) => {
    const metricsToken =
        process.env.METRICS_TOKEN ||
        (config.has('services.metricsToken') ? config.get('services.metricsToken') : '');

    if (metricsToken && req.get('x-metrics-token') !== metricsToken) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden'
        });
    }

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.renderMetrics());
});

app.use("/api/v1/admin",passport.authenticate('user-token', { session : false }),admin);
app.use("/api/v1/user",passport.authenticate('user-token', { session : false }),user);
app.use('/api/v1/subject',passport.authenticate('user-token', { session : false }),universal);
app.use('/api/v1/questions',passport.authenticate('user-token', { session : false }),question);
app.use('/api/v1/test',passport.authenticate('user-token', { session : false }),testpaper);
app.use(
  '/api/v1/upload',
   passport.authenticate('user-token', { session: false }),
   fileUploadRouter
);
app.use('/api/v1/trainer',passport.authenticate('user-token', { session : false }),stopRegistration);
app.use(
    '/api/v1/dashboard',
    passport.authenticate('user-token', { session: false }),
    dashboardRoutes
  );
app.use('/api/v1/trainee',trainee);
app.use('/api/v1/final',results);
app.use('/api/v1/lala',dummy);







app.use('/api/v1/login',login);

app.get(/^(?!\/api\/).*/, (req,res) =>{
    if (req.path.startsWith('/result/')) {
        return res.status(404).json({
            success: false,
            message: 'Result file not found'
        });
    }
    res.sendFile(path.join(__dirname+'/public/index.html'));
});


tool.createadmin();


//error handlings
app.use(function(req, res, next) {
    next(createError(404,"Invalid API. Use the official documentation to get the list of valid APIS."));
});

app.use((err, req, res, next)=>{
    const status = err.status || 500;
    appLogger.error('request_failure', {
        route: req.originalUrl,
        method: req.method,
        status,
        error: appLogger.normalizeError(err)
    });
    sendFailureAlert({
        source: 'http-api',
        event: 'request_failure',
        severity: status >= 500 ? 'critical' : 'error',
        message: err.message || 'Unhandled request error',
        details: {
            route: req.originalUrl,
            method: req.method,
            status
        }
    });

    res.status(status).json({
        success : false,
        message : err.message
    });
});

app.listen(PORT,(err)=>{
    if(err){
      appLogger.error('server_start_failed', { error: appLogger.normalizeError(err) });
      return;
    }
    appLogger.info('server_started', { port: PORT });
});

require('./wsServer');
require('./resultServer');

process.on('unhandledRejection', (reason) => {
    appLogger.error('unhandled_rejection', { error: appLogger.normalizeError(reason) });
    sendFailureAlert({
        source: 'node-process',
        event: 'unhandled_rejection',
        severity: 'critical',
        message: 'Unhandled promise rejection',
        details: appLogger.normalizeError(reason)
    });
});

process.on('uncaughtException', (error) => {
    appLogger.error('uncaught_exception', { error: appLogger.normalizeError(error) });
    sendFailureAlert({
        source: 'node-process',
        event: 'uncaught_exception',
        severity: 'critical',
        message: error.message || 'Uncaught exception',
        details: appLogger.normalizeError(error)
    });
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});
