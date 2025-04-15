import { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Index,
  Table,
  IsUUID,
  PrimaryKey,
  Default,
  AllowNull,
} from "sequelize-typescript";
import GameMap from "./GameMap";
import MapIcon from "./MapIcon";
import MarkerCategory from "./MarkerCategory";
import User from "./User";
import Model from "./base/Model";

export type Coordinate = {
  x: number;
  y: number;
  z: number;
};

@Table({ tableName: "markers", timestamps: true, paranoid: true })
export default class Marker extends Model<
  InferAttributes<Marker>,
  InferCreationAttributes<Marker>
> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id: string;

  @Column(DataType.STRING)
  title: string;

  @Column(DataType.TEXT)
  description: string | null;

  @Column(DataType.JSONB)
  coordinate: Coordinate | null;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  public: boolean;

  // Associations
  @ForeignKey(() => MapIcon)
  @Index
  @Column(DataType.UUID)
  iconId: string;

  @BelongsTo(() => MapIcon, "iconId")
  icon: MapIcon;

  @ForeignKey(() => MarkerCategory)
  @Index
  @Column(DataType.UUID)
  categoryId: string;

  @BelongsTo(() => MarkerCategory, "categoryId")
  category: MarkerCategory;

  @ForeignKey(() => User)
  @Index
  @Column(DataType.UUID)
  ownerId: string | null;

  @BelongsTo(() => User, "ownerId")
  owner: User | null;

  @ForeignKey(() => GameMap)
  @Index
  @Column(DataType.UUID)
  mapId: string;

  @BelongsTo(() => GameMap, "mapId")
  map: GameMap;
}
