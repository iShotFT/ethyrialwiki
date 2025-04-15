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
} from "sequelize-typescript";
import Model from "./base/Model";
import GameMap from "./GameMap";
import GameItem from "./GameItem";
import Fix from "./decorators/Fix";

// Define the structure for the coordinates JSONB column
interface ResourceCoordinates {
  x: number;
  y: number;
  z: number;
}

@Table({ tableName: "game_resources", modelName: "GameResource", timestamps: true, paranoid: true })
@Fix
class GameResource extends Model<InferAttributes<GameResource>, InferCreationAttributes<GameResource>> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  coordinates: ResourceCoordinates;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  public: boolean;

  // --- Associations --- //

  @ForeignKey(() => GameMap)
  @AllowNull(false)
  @Column(DataType.UUID)
  mapId: string;

  @BelongsTo(() => GameMap, "mapId")
  map: GameMap;

  @ForeignKey(() => GameItem)
  @AllowNull(false)
  @Column(DataType.UUID)
  itemId: string;

  @BelongsTo(() => GameItem, "itemId")
  item: GameItem;
}

export default GameResource; 