'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add itemBackgroundColorHex column to game_item_rarities table
     */
    await queryInterface.addColumn('game_item_rarities', 'itemBackgroundColorHex', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'colorHex' // Add after the colorHex column
    });

    // Update existing rarities to have appropriate background colors
    // for example: Epic with a nice purple background, Legendary with an orange, etc.
    await queryInterface.sequelize.query(`
      UPDATE game_item_rarities
      SET "itemBackgroundColorHex" = 
        CASE 
          WHEN slug = 'common' THEN '#696969'
          WHEN slug = 'uncommon' THEN '#235a29'
          WHEN slug = 'rare' THEN '#25386a'
          WHEN slug = 'epic' THEN '#38233c'
          WHEN slug = 'legendary' THEN '#6a482d'
          ELSE NULL
        END
      WHERE slug IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'relic', 'quest-item')
    `);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove itemBackgroundColorHex column from game_item_rarities table
     */
    await queryInterface.removeColumn('game_item_rarities', 'itemBackgroundColorHex');
  }
};
