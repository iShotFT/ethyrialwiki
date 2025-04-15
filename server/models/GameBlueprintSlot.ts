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
  Min,
  Max,
} from "sequelize-typescript";
import Model from "./base/Model";
import GameBlueprint from "./GameBlueprint";
import GameItem from "./GameItem";
import Fix from "./decorators/Fix";

@Table({ tableName: "game_blueprint_slots", modelName: "GameBlueprintSlot", timestamps: true, paranoid: true })
@Fix
class GameBlueprintSlot extends Model<InferAttributes<GameBlueprintSlot>, InferCreationAttributes<GameBlueprintSlot>> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Min(0)
  @Max(5)
  @Column(DataType.INTEGER)
  x: number;

  @AllowNull(false)
  @Min(0)
  @Max(4)
  @Column(DataType.INTEGER)
  y: number;

  // --- Associations --- //

  @ForeignKey(() => GameBlueprint)
  @AllowNull(false)
  @Column(DataType.UUID)
  blueprintId: string;

  @BelongsTo(() => GameBlueprint, "blueprintId")
  blueprint: GameBlueprint;

  @ForeignKey(() => GameItem)
  @AllowNull(true)
  @Column(DataType.UUID)
  itemId: string | null; // Can be empty

  @BelongsTo(() => GameItem, "itemId")
  item: GameItem | null;
}

export default GameBlueprintSlot; 