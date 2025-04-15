'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('marker_categories', 'parentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'marker_categories', // Self-referencing
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL', // Or CASCADE, depending on desired behavior
    });

    // Add index for parentId
    await queryInterface.addIndex('marker_categories', ['parentId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('marker_categories', ['parentId']);
    await queryInterface.removeColumn('marker_categories', 'parentId');
  }
}; 