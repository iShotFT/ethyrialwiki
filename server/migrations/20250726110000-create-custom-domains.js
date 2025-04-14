'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("custom_domains", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      hostname: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      handlerType: {
        type: Sequelize.STRING, // Consider Sequelize.ENUM if desired DB support exists
        allowNull: false,
        comment: "Type of handler for this domain (e.g., 'map_view', 'default_app')",
      },
      handlerConfig: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "JSON configuration specific to the handler type",
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "teams",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "Optional team association for management",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("custom_domains", ["hostname"], { unique: true });
    await queryInterface.addIndex("custom_domains", ["handlerType"]);
    await queryInterface.addIndex("custom_domains", ["teamId"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("custom_domains");
  },
}; 