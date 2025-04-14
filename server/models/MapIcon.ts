import { Column, DataType, HasMany, Table, IsUUID, PrimaryKey, Default } from "sequelize-typescript";
import { InferAttributes, InferCreationAttributes } from "sequelize/types";
import Marker from "./Marker";
import MarkerCategory from "./MarkerCategory";
import Model from "./base/Model";

@Table({ tableName: "map_icons", timestamps: true, paranoid: true })
export default class MapIcon extends Model<InferAttributes<MapIcon>, InferCreationAttributes<MapIcon>> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id: string;

  @Column(DataType.STRING)
  path: string;

  @Column(DataType.BOOLEAN)
  public: boolean;

  // Associations
  @HasMany(() => MarkerCategory)
  categories: MarkerCategory[];

  @HasMany(() => Marker)
  markers: Marker[];
} 