"use strict";

module.exports = function (sequelize, DataTypes) {

    var User = sequelize.define('User', {
        userName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        encryptedPassword: {
            type: DataTypes.STRING,
            allowNull: false
        },
        machineCode: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        sig: {
            type: DataTypes.TEXT('long'),
            allowNull: false
        }
    }, {
        classMethods: {
            associate: function (models) {
                User.hasMany(models.Icon)
            }
        }
    });

    return User;
};
