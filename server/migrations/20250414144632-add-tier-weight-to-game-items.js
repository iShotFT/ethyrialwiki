'use strict';

const TABLE_NAME = "game_items";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn(TABLE_NAME, 'tier', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: 'rarityId' // Place after rarityId for logical grouping (optional)
    });
    await queryInterface.addColumn(TABLE_NAME, 'weight', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
      after: 'tier' // Place after tier
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn(TABLE_NAME, 'weight');
    await queryInterface.removeColumn(TABLE_NAME, 'tier');
  }
};
