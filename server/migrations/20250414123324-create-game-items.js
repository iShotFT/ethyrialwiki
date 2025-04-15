'use strict';

const TABLE_NAME = "game_items";

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
      iconId: {
        type: Sequelize.UUID,
        allowNull: true, // Required icon?
        references: {
          model: 'game_icons',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      dropable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      rarityId: {
        type: Sequelize.UUID,
        allowNull: true, // Assuming not all items have rarity
        references: {
          model: 'game_item_rarities',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      onUseEffect: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      usedForSkillId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'game_skills',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      gatheringSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      requiresSkillId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'game_skills',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      requiresSkillLevel: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      craftable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      craftingSkillId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'game_skills',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      craftingTier: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      craftingXp: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
    await queryInterface.addIndex(TABLE_NAME, ["iconId"]);
    await queryInterface.addIndex(TABLE_NAME, ["rarityId"]);
    await queryInterface.addIndex(TABLE_NAME, ["usedForSkillId"]);
    await queryInterface.addIndex(TABLE_NAME, ["requiresSkillId"]);
    await queryInterface.addIndex(TABLE_NAME, ["craftingSkillId"]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable(TABLE_NAME);
  }
};
