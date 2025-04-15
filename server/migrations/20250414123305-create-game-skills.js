'use strict';

const TABLE_NAME = "game_skills";
const ENUM_NAME = `enum_${TABLE_NAME}_type`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE_NAME, {
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
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM('COMBAT', 'DISCIPLINES', 'PROFESSION'),
        allowNull: true,
        defaultValue: null,
      },
      crafting: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      iconId: {
        type: Sequelize.UUID,
        allowNull: true, // Icon might not always be present
        references: {
          model: 'game_icons',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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
    await queryInterface.addIndex(TABLE_NAME, ["slug"]);
    await queryInterface.addIndex(TABLE_NAME, ["type"]);
    await queryInterface.addIndex(TABLE_NAME, ["iconId"]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable(TABLE_NAME);
    // We need to manually drop the ENUM type in PostgreSQL
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${ENUM_NAME}";`);
  }
};
