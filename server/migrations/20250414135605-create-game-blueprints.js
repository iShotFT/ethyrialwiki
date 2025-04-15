'use strict';

const TABLE_NAME = "game_blueprints";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      width: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      height: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      outputItemId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'game_items', // References the output item
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // Or RESTRICT if blueprints shouldn't be deletable if items reference them?
      },
      craftingSkillId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'game_skills',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      craftingTier: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      craftingXp: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
    await queryInterface.addIndex(TABLE_NAME, ["outputItemId"]);
    await queryInterface.addIndex(TABLE_NAME, ["craftingSkillId"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable(TABLE_NAME);
  },
}; 