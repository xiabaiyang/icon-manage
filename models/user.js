"use strict";

module.exports = function(sequelize, DataTypes) {

  var User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }// 机器码
  }, {
      classMethods: {
        associate: function(models) {
          User.hasMany(models.Icon)
        }
      }
  });

  return User;
};