"use strict";

module.exports = function (sequelize, DataTypes) {

    var User = sequelize.define('User', {
        userName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        encryptedPassword: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // machineCode: {
        //     type: DataTypes.STRING,
        //     allowNull: false,
        //     unique: true
        // },
        sig: {
            type: DataTypes.TEXT('long'),
            allowNull: true
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
