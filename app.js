var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var timeout = require('connect-timeout');
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');

var routes = require('./routes/index');
var users = require('./routes/users');
//var cve = require('./routes/cveOutput');
var search = require('./routes/dbSearch');
var results = require('./routes/dbResults');
var update = require('./routes/dbForceUpdate');
var editbom = require('./routes/editbom');
var login = require('./routes/login');
var projects = require('./routes/projects');
var logout = require('./routes/logout');
var auth = require('./routes/auth');

require('./config/passport')(passport);

var app = express();
//app.locals.delimiters = '<% %>';

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(timeout(180000));

// required for passport
app.use(session({ secret: 'sunrisevulnapp' })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

app.use('/', routes);
app.use('/users', users);
app.use('/dbSearch', search);
app.use('/dbResults', results);
app.use('/dbForceUpdate', update)
app.use('/editbom', editbom);
app.use('/login', login);
app.use('/projects', projects);
app.use('/logout', logout);
app.use('/auth', auth);
//app.use('/cve', cve);

var options = { server: { socketOptions: { keepAlive: 3000000, connectTimeoutMS: 300000 } }, 
replset: { socketOptions: { keepAlive: 3000000, connectTimeoutMS : 300000 } } }; 

var vulnURI = 'mongodb://localhost/vuln';

var connectionOpen = function() {
  mongoose.connect(vulnURI, options);
}

mongoose.connection.on('disconnected', function () {  
  console.log('Mongoose default connection disconnected');
});

mongoose.connection.on('connected', function () {  
  console.log('Mongoose default connection connected');
});

connectionOpen();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
