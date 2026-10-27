const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('../routes/index');
const usersRouter = require('../routes/users');
const apiRouter = require('../routes/api');
const authRouter = require('../routes/auth');
const { initialize } = require('../db');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database once per instance; requests wait for it (cold starts)
const dbPromise = initialize().then((db) => {
  app.locals.db = db;
  return db;
});

app.use((req, res, next) => {
  dbPromise.then(() => next()).catch((err) => {
    console.error('Database initialization failed:', err);
    res.status(503).json({ error: 'Database not ready' });
  });
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', apiRouter);
app.use('/auth', authRouter);

module.exports = app;
