'use strict';

const TABLE_NAME = "marker_categories";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(TABLE_NAME, 'isLabel', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'displayGroup' // Optional: place after displayGroup column
    });
    await queryInterface.addIndex(TABLE_NAME, ['isLabel']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(TABLE_NAME, 'isLabel');
  }
};
