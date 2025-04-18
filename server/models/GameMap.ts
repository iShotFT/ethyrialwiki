import { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  Column,
  DataType,
  HasMany,
  Table,
  IsUUID,
  PrimaryKey,
  Default,
} from "sequelize-typescript";
import Marker from "./Marker";
import Model from "./base/Model";
import GameResource from "./GameResource";

@Table({ tableName: "maps", timestamps: true, paranoid: true })
export default class GameMap extends Model<
  InferAttributes<GameMap>,
  InferCreationAttributes<GameMap>
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

  @Column(DataType.STRING)
  path: string;

  @Column(DataType.BOOLEAN)
  public: boolean;

  // Associations
  @HasMany(() => Marker)
  markers: Marker[];

  @HasMany(() => GameResource, 'mapId')
  gameResources: GameResource[];
}
