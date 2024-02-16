const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session(
    {
        secret: '6995e7b57f19eb0c602e3b3badee678e40a13881f0bd60c0f44268ad2a52ed7e1720593151bdf3eddca51bdd0731c88ca285b5bff0afbdb55800af649864d522cc8eb206c16e16036815cd029e39577858c903ce555f1668790df7dfa06a1dc9f2250fb96c3e064ec624e986e6afb87b4d7453b2477ecd7d23905f0d0a886b091120e8d92e32c2c47c459b4b5b3e706360c429df120f80a7a0e3bd81466405f7bbc694ab291d3e1ef64674f3212bc0c9726e70cd32170ccb9fae42b1e369a27964b1fc18f51f8fd3bd962a39b31127fd6551f1ba4e00cbc60fa4947088944922dfd34bc5ff2abe3af649046da67beac4229b6fd5f8c570a98bba2e31acd6286a',
        resave: false,
        saveUninitialized: true,
    }
));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
