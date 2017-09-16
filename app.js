"use strict";

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');

var session = require('express-session'); // 创建 session 中间件
var MySQLStore = require('express-mysql-session')(session); // 将 session 存在 mysql 中

var util = require('./util');
var options = {
    host: util.get('database.host'),
    port: util.get('database.port'),
    user: util.get('database.user'),
    password: util.get('database.password'),
    database: util.get('database.database')
};

var routes = require('./routes/index');
var users  = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.set('trust proxy', 'loopback'); // 代理端口

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

app.all('*',function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization, Access-Control-Allow-Origin');
  res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');

  if (req.method == 'OPTIONS') {
    res.send(200); // 让options请求快速返回
  }
  else {
    next();
  }
});

app.use(session({
    name: 'session',                     // 设置 cookie 中,保存 session 的字段名称,默认为 connect.sid
    secret: 'gPVgZmiJNs7AoveHkXgDNqjB',  // 对存放 session id 的 cookie 进行签名,计算 hash 值并放在 cookie 中,使产生的 signedCookie 防篡改
    store: new MySQLStore(options),      // session 的存储方式
    resave: true,                        // 是否每次都重新保存会话
    saveUninitialized: false,            // 是否自动保存未初始化的会话
    cookie: {                            // 设置存放 session id 的 cookie,默认为 { path: '/', httpOnly: true, secure: false, maxAge: null }
        maxAge: 10 * 1000
    }
}));

// genid: 产生一个新的 session_id 时，所使用的函数， 默认使用 uid2 这个 npm 包
// rolling: 每个请求都重新设置一个 cookie，默认为 false

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
