"use strict";

module.exports = function (sequelize, DataTypes) {

    var User = sequelize.define('User', {
        userName: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        encryptedPassword: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: false
        },
        mail: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: false
        }
        // sig: {
        //     type: DataTypes.TEXT('long'),
        //     allowNull: true
        // }
    }, {
        classMethods: {
            associate: function (models) {
                User.hasMany(models.Icon);
                User.belongsToMany(models.Project, { through: 'ProjectMembers' });
            }
        }
    });

    return User;
};
