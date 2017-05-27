"use strict";

module.exports = function (sequelize, DataTypes) {
    var ProjectMember = sequelize.define("ProjectMember", {
        projectId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: false
        },
        // projectName: {
        //     type: DataTypes.STRING,
        //     allowNull: true,
        //     unique: false
        // },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: false
        }
        // ,
        // userName: {
        //     type: DataTypes.STRING,
        //     allowNull: true,
        //     unique: false
        // }
    }, {
        classMethods: {
        }
    });

    return ProjectMember;
};
