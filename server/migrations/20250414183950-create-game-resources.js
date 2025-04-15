'use strict';

const TABLE_NAME = "game_resources";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      mapId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'maps',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      itemId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'game_items',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      coordinates: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: "Resource node coordinates {x, y, z}",
      },
      public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
    await queryInterface.addIndex(TABLE_NAME, ["mapId"]);
    await queryInterface.addIndex(TABLE_NAME, ["itemId"]);
    // Optional: Index on coordinates if needed for spatial queries, but might be slow
    // await queryInterface.addIndex(TABLE_NAME, ["coordinates"], { using: 'gin' });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable(TABLE_NAME);
  },
};
