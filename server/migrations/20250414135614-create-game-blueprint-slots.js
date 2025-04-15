'use strict';

const TABLE_NAME = "game_blueprint_slots";

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
      blueprintId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'game_blueprints',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      x: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      y: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      itemId: {
        type: Sequelize.UUID,
        allowNull: true, // Slot might be empty
        references: {
          model: 'game_items',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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
    await queryInterface.addIndex(TABLE_NAME, ["blueprintId"]);
    await queryInterface.addIndex(TABLE_NAME, ["itemId"]);
    await queryInterface.addIndex(TABLE_NAME, ["blueprintId", "x", "y"], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable(TABLE_NAME);
  }
};
