'use strict';

const TABLE_NAME = "game_items";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove columns moved to Blueprint
    await queryInterface.removeColumn(TABLE_NAME, 'craftable');
    await queryInterface.removeColumn(TABLE_NAME, 'craftingSkillId');
    await queryInterface.removeColumn(TABLE_NAME, 'craftingTier');
    await queryInterface.removeColumn(TABLE_NAME, 'craftingXp');

    // Add blueprint column
    await queryInterface.addColumn(TABLE_NAME, 'blueprintId', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: {
        model: 'game_blueprints',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex(TABLE_NAME, ['blueprintId']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove blueprint column
    await queryInterface.removeColumn(TABLE_NAME, 'blueprintId');

    // Re-add columns moved from Blueprint
    await queryInterface.addColumn(TABLE_NAME, 'craftable', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn(TABLE_NAME, 'craftingSkillId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'game_skills',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
    });
    await queryInterface.addColumn(TABLE_NAME, 'craftingTier', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    });
    await queryInterface.addColumn(TABLE_NAME, 'craftingXp', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    });
    await queryInterface.addIndex(TABLE_NAME, ["craftingSkillId"]);
  }
};
