import { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  Table,
  Column,
  DataType,
  Default,
  AllowNull,
  PrimaryKey,
  IsUUID,
  BelongsTo,
  ForeignKey,
  HasMany,
  Min,
  Max,
} from "sequelize-typescript";
import Model from "./base/Model";
import GameItem from "./GameItem";
import GameSkill from "./GameSkill";
import GameBlueprintSlot from "./GameBlueprintSlot";
import Fix from "./decorators/Fix";

@Table({ tableName: "game_blueprints", modelName: "GameBlueprint", timestamps: true, paranoid: true })
@Fix
class GameBlueprint extends Model<InferAttributes<GameBlueprint>, InferCreationAttributes<GameBlueprint>> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @AllowNull(false)
  @Min(1)
  @Max(6)
  @Column(DataType.INTEGER)
  width: number;

  @AllowNull(false)
  @Min(1)
  @Max(5)
  @Column(DataType.INTEGER)
  height: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  craftingTier: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  craftingXp: number;

  // --- Associations --- //

  @ForeignKey(() => GameItem)
  @AllowNull(false)
  @Column(DataType.UUID)
  outputItemId: string;

  @BelongsTo(() => GameItem, "outputItemId")
  outputItem: GameItem;

  @ForeignKey(() => GameSkill)
  @AllowNull(true)
  @Column(DataType.UUID)
  craftingSkillId: string | null;

  @BelongsTo(() => GameSkill, "craftingSkillId")
  craftingSkill: GameSkill | null;

  @HasMany(() => GameBlueprintSlot, 'blueprintId')
  slots: GameBlueprintSlot[];

  @HasMany(() => GameItem, 'blueprintId')
  itemsUsingThis: GameItem[]; // Items that are created by this blueprint
}

export default GameBlueprint; 