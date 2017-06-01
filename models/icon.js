"use strict";

module.exports = function (sequelize, DataTypes) {
    var Icon = sequelize.define("Icon", {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: false
        },
        content: {
            type: DataTypes.TEXT('long'),
            allowNull: false,
            unique: false
        },
        projectId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: false
        },
        categoryId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: false
        },
        remarks: {
            type: DataTypes.TEXT('long'),
            allowNull: true,
            unique: false
        },
        version: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: false
        },
        experienceVersion: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            unique: false
        }
    }, {
        classMethods: {
            associate: function (models) {
                Icon.belongsTo(models.User, {
                    onDelete: "CASCADE",
                    foreignKey: {
                        allowNull: false
                    }
                });
            }
        }
    });

    return Icon;
};
