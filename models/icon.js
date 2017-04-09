"use strict";

module.exports = function(sequelize, DataTypes) {
  var Icon = sequelize.define("Icon", {
    content: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      unique: false
    }
  }, {
    classMethods: {
      associate: function(models) {
        // Using additional options like CASCADE etc for demonstration
        // Can also simply do Icon.belongsTo(models.User);
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
