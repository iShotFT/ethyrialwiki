import { InferAttributes, InferCreationAttributes } from "sequelize/types";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Index,
  Table,
  IsUUID,
  PrimaryKey,
  Default,
} from "sequelize-typescript";
import MapIcon from "./MapIcon";
import Marker from "./Marker";
import Model from "./base/Model";

@Table({ tableName: "marker_categories", timestamps: true, paranoid: true })
export default class MarkerCategory extends Model<
  InferAttributes<MarkerCategory>,
  InferCreationAttributes<MarkerCategory>
> {
  @IsUUID("all")
  @PrimaryKey
  @Column({ type: DataType.UUID })
  id: string;

  @Column(DataType.STRING)
  title: string;

  @Column(DataType.TEXT)
  description: string | null;

  @Column(DataType.BOOLEAN)
  public: boolean;

  // Associations
  @ForeignKey(() => MapIcon)
  @Index
  @Column(DataType.UUID)
  iconId: string;

  @BelongsTo(() => MapIcon, "iconId")
  icon: MapIcon;

  @HasMany(() => Marker)
  markers: Marker[];

  // Parent Category (Self-referencing)
  @ForeignKey(() => MarkerCategory)
  @Index
  @Column({ type: DataType.UUID, allowNull: true }) // Allow null for top-level
  parentId: string | null;

  @BelongsTo(() => MarkerCategory, "parentId")
  parent: MarkerCategory | null;

  @HasMany(() => MarkerCategory, "parentId")
  children: MarkerCategory[];
}
