'use strict';

const TABLE_NAME = "markers";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the column
    await queryInterface.removeColumn(TABLE_NAME, 'isLabel');
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add the column if rolling back
    await queryInterface.addColumn(TABLE_NAME, 'isLabel', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'public'
    });
    await queryInterface.addIndex(TABLE_NAME, ['isLabel']);
  }
};
