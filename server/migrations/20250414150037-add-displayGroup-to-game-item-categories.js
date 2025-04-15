'use strict';

const TABLE_NAME = "game_item_categories";
const ENUM_NAME = `enum_${TABLE_NAME}_displayGroup`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Define the ENUM type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${ENUM_NAME}') THEN
              CREATE TYPE "${ENUM_NAME}" AS ENUM('HEATMAP');
          END IF;
      END$$;
    `);

    // Add the column to the table
    await queryInterface.addColumn(TABLE_NAME, 'displayGroup', {
      type: Sequelize.ENUM('HEATMAP'), // Reference the created ENUM type
      allowNull: true,
      defaultValue: null,
      after: 'public' // Optional: place after public column
    });

    await queryInterface.addIndex(TABLE_NAME, ['displayGroup']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn(TABLE_NAME, 'displayGroup');
    // Manually drop the ENUM type
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${ENUM_NAME}";`);
  }
};
