"use strict";

module.exports = function (sequelize, DataTypes) {
    var Project = sequelize.define("Project", {
        proName: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: false
        },
        ownerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: false
        },
        ownerName: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: false
        },
        invitedKey: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        }
    }, {
        classMethods: {
            associate: function (models) {
                Project.belongsToMany(models.User, { through: 'ProjectMember' });
            }
        }
    });

    return Project;
};
