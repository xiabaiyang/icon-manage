var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var corser = require('corser'); // 解决跨域问题
var global = require('./config/global.json');

// var env = process.env.NODE_ENV || 'development';
var env = 'production';
var sessionPath = path.resolve(__dirname, './config/' + env + '/session.json');

// session
var session = require('express-session'); // 创建 session 中间件
// var MySQLStore = require('express-mysql-session')(session); // 将 session 存在 mysql 中
// var options = require(sessionPath); // 数据库配置信息

// 路由
var routes = require('./routes/index');
var users  = require('./routes/users');

// var favicon = require('serve-favicon');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.set('trust proxy', 'loopback'); // 代理端口

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

// CORS 解决跨域
app.use(corser.create({
    methods: corser.simpleMethods.concat(["PUT"]),
    requestHeaders: corser.simpleRequestHeaders.concat(["X-Requested-With"])
}));
app.all('*', function (request, response, next) {
    response.header('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With,Authorization,Access-Control-Allow-Origin');
    response.header('Access-Control-Allow-Methods', 'POST,GET,DELETE');
    response.header('Access-Control-Allow-Origin', '*');
    next();
});

// session 设置 (secret需要自动生成) 暂时不用
// var sessionStore = new MySQLStore(options);
// var identityKey = 'userName';
// app.use(session({
//     name: identityKey,
//     secret: '1792B4344F7D80C6189E', // 用来对 session id 相关的 cookie 进行签名
//     store: sessionStore, // 本地存储 session
//     resave: true, // 是否每次都重新保存会话，建议 false
//     saveUninitialized: true, // 是否自动保存未初始化的会话，建议 false
//     cookie: {
//         maxAge: 10 * 1000  // 有效期，单位是毫秒
//     }
// }));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
// app.use(function(err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};
//
//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });

module.exports = app;
