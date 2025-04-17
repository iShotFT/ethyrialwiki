'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add sortOrder column to game_item_rarities table
     */
    await queryInterface.addColumn('game_item_rarities', 'sortOrder', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: 'itemBackgroundColorHex' // Add after the itemBackgroundColorHex column
    });

    // Set initial sort order values based on rarity "level"
    await queryInterface.sequelize.query(`
      UPDATE game_item_rarities
      SET "sortOrder" = 
        CASE 
          WHEN slug = 'common' THEN 10
          WHEN slug = 'uncommon' THEN 20
          WHEN slug = 'rare' THEN 30
          WHEN slug = 'epic' THEN 40
          WHEN slug = 'legendary' THEN 50
          WHEN slug = 'relic' THEN 60
          WHEN slug = 'quest-item' THEN 5
          ELSE 0
        END
      WHERE slug IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'relic', 'quest-item')
    `);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove sortOrder column from game_item_rarities table
     */
    await queryInterface.removeColumn('game_item_rarities', 'sortOrder');
  }
}; 