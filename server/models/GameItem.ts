import { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  Table,
  Column,
  DataType,
  Default,
  AllowNull,
  Unique,
  IsUUID,
  PrimaryKey,
  BelongsTo,
  ForeignKey,
  BelongsToMany,
  HasMany,
} from "sequelize-typescript";
import Model from "./base/Model";
import GameIcon from "./GameIcon";
import GameItemRarity from "./GameItemRarity";
import GameSkill from "./GameSkill";
import GameItemCategory from "./GameItemCategory";
import GameItemItemCategory from "./GameItemItemCategory"; // Join table model 1
import GameItemModifier from "./GameItemModifier";       // Join table model 2
import GameBlueprint from "./GameBlueprint";          // Import Blueprint
import Fix from "./decorators/Fix";
import GameResource from "./GameResource";

@Table({ tableName: "game_items", modelName: "GameItem", timestamps: true, paranoid: true })
@Fix
class GameItem extends Model<InferAttributes<GameItem>, InferCreationAttributes<GameItem>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  slug: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  title: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string | null;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  public: boolean;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  dropable: boolean;

  @AllowNull(true)
  @Column(DataType.STRING)
  onUseEffect: string | null;

  @AllowNull(true)
  @Default(null)
  @Column(DataType.FLOAT)
  gatheringSpeed: number | null;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  requiresSkillLevel: number;

  // Add new columns
  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  tier: number;

  @AllowNull(false)
  @Default(0.0)
  @Column(DataType.FLOAT)
  weight: number;

  // --- Associations --- //

  @ForeignKey(() => GameIcon)
  @AllowNull(true)
  @Column(DataType.UUID)
  iconId: string | null;

  @BelongsTo(() => GameIcon, "iconId")
  icon: GameIcon | null;

  @ForeignKey(() => GameItemRarity)
  @AllowNull(true)
  @Column(DataType.UUID)
  rarityId: string | null;

  @BelongsTo(() => GameItemRarity, "rarityId")
  rarity: GameItemRarity | null;

  @ForeignKey(() => GameSkill)
  @AllowNull(true)
  @Column(DataType.UUID)
  usedForSkillId: string | null;

  @BelongsTo(() => GameSkill, "usedForSkillId")
  usedForSkill: GameSkill | null;

  @ForeignKey(() => GameSkill)
  @AllowNull(true)
  @Column(DataType.UUID)
  requiresSkillId: string | null;

  @BelongsTo(() => GameSkill, "requiresSkillId")
  requiresSkill: GameSkill | null;

  @ForeignKey(() => GameBlueprint)
  @AllowNull(true)
  @Column(DataType.UUID)
  blueprintId: string | null;

  @BelongsTo(() => GameBlueprint, "blueprintId")
  blueprint: GameBlueprint | null;

  // Many-to-many categories
  @BelongsToMany(() => GameItemCategory, () => GameItemItemCategory)
  itemCategories: GameItemCategory[];

  // Many-to-many modifiers
  @BelongsToMany(() => GameSkill, () => GameItemModifier)
  skillModifiers: (GameSkill & { GameItemModifier: GameItemModifier })[];

  @HasMany(() => GameResource, 'itemId')
  resourceNodes: GameResource[];
}

export default GameItem; 