"use strict";

var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');
var env = process.env.NODE_ENV || 'development';

var configPath = path.resolve(__dirname, '../config/' + env + '/database.json');
var config = require(configPath);

var sequelize = new Sequelize(config.database, config.user, config.password, config);

var db = {};

fs
  .readdirSync(__dirname)
  .filter(function(file) {
      return (file.indexOf(".") !== 0) && (file !== "index.js");
  })
  .forEach(function(file) {
      var model = sequelize.import(path.join(__dirname, file));
      db[model.name] = model;
  });

// 关联不同的 models
Object.keys(db).forEach(function(modelName) {
    if ("associate" in db[modelName]) {
      db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
