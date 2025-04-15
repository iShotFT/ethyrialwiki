'use strict';

const TABLE_NAME = "markers";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn(TABLE_NAME, 'isLabel', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'public' // Optional: place after public column
    });
    // Add index for potential filtering
    await queryInterface.addIndex(TABLE_NAME, ['isLabel']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn(TABLE_NAME, 'isLabel');
  }
};
