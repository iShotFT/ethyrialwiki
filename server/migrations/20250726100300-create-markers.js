'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("markers", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      iconId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "map_icons",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        comment: "Icon for the marker",
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      categoryId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "marker_categories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        comment: "Category the marker belongs to",
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users", // Assuming Outline's user table is named 'users'
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "User who owns this marker (null for public markers)",
      },
      mapId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "maps",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "The map this marker belongs to",
      },
      coordinate: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: "Marker coordinates in {x, y, z} format",
      },
      public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Forces the marker to be public regardless of ownerId",
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

    // Add indexes for commonly queried columns
    await queryInterface.addIndex("markers", ["iconId"]);
    await queryInterface.addIndex("markers", ["categoryId"]);
    await queryInterface.addIndex("markers", ["ownerId"]);
    await queryInterface.addIndex("markers", ["mapId"]);
    await queryInterface.addIndex("markers", ["public"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("markers");
  },
}; 