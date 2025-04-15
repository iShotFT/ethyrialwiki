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
import GameItem from "./GameItem";
import GameItemModifier from "./GameItemModifier"; // Join table model
import Fix from "./decorators/Fix";
import GameBlueprint from "./GameBlueprint";

export enum GameSkillType {
  COMBAT = 'COMBAT',
  DISCIPLINES = 'DISCIPLINES',
  PROFESSION = 'PROFESSION',
}

@Table({ tableName: "game_skills", modelName: "GameSkill", timestamps: true, paranoid: true })
@Fix
class GameSkill extends Model<InferAttributes<GameSkill>, InferCreationAttributes<GameSkill>> {
  @IsUUID(4)
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

  @AllowNull(true)
  @Default(null)
  @Column(DataType.ENUM(...Object.values(GameSkillType)))
  type: GameSkillType | null;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  crafting: boolean;

  // Associations
  @ForeignKey(() => GameIcon)
  @AllowNull(true)
  @Column(DataType.UUID)
  iconId: string | null;

  @BelongsTo(() => GameIcon, "iconId")
  icon: GameIcon | null;

  @HasMany(() => GameItem, 'usedForSkillId')
  itemsUsedFor: GameItem[];

  @HasMany(() => GameItem, 'requiresSkillId')
  itemsRequiring: GameItem[];

  @HasMany(() => GameBlueprint, 'craftingSkillId')
  blueprintsUsingSkill: GameBlueprint[];

  // Many-to-many for modifiers
  @BelongsToMany(() => GameItem, () => GameItemModifier)
  itemsModified: (GameItem & { GameItemModifier: GameItemModifier })[];
}

export default GameSkill; 