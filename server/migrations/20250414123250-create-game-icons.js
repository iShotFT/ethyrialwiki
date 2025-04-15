'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("game_icons", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      originalName: {
        type: Sequelize.STRING,
        allowNull: true, // Assuming original name might not always be present
      },
      path: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "S3 path to the icon image",
      },
      public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.addIndex("game_icons", ["slug"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("game_icons");
  },
};
