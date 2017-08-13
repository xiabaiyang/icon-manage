"use strict";

module.exports = function (sequelize, DataTypes) {
    var Category = sequelize.define("Category", {
        categoryName: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: false
        },
        online: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            unique: false
        }
    }, {
        classMethods: {
            associate: function (models) {
                Category.belongsTo(models.Project, {
                    onDelete: "CASCADE",
                    foreignKey: {
                        allowNull: false
                    }
                });
            }
        }
    });

    return Category;
};
