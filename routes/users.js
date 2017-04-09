// var express = require('express');
// var db = require('../models');
// var _ = require('lodash');
// var path = require('path');
// var config = require('../config/global.json');
//
// var router = express.Router();
//
// /* GET home page. */
// router.get('/', function(req, res, next) {
//   res.render('index', { title: 'icon' });
// });
//
// module.exports = router;

var models  = require('../models');
var express = require('express');
var router  = express.Router();

router.post('/create', function(req, res) {
  models.User.create({
    username: req.body.username,
    password: req.body.password
  }).then(function() {
    res.redirect('/');
  });
});

router.get('/:user_id/destroy', function(req, res) {
  models.User.destroy({
    where: {
      id: req.params.user_id
    }
  }).then(function() {
    res.redirect('/');
  });
});

router.post('/:user_id/icons/create', function (req, res) {
  models.Icon.create({
    content: req.body.content,
    UserId: req.params.user_id
  }).then(function() {
    res.redirect('/');
  });
});

router.get('/:user_id/icons/:task_id/destroy', function (req, res) {
  models.Icon.destroy({
    where: {
      id: req.params.task_id
    }
  }).then(function() {
    res.redirect('/');
  });
});

module.exports = router;
