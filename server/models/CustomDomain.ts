import { BelongsTo, Column, DataType, ForeignKey, Index, Table, PrimaryKey, Default } from "sequelize-typescript";
import { InferAttributes, InferCreationAttributes } from "sequelize/types";
import Team from "./Team";
import Model from "./base/Model";

export type HandlerConfig = {
  mapId?: string;
  staticPath?: string;
  shareId?: string;
  [key: string]: any;
};

@Table({ tableName: "custom_domains", timestamps: true })
export default class CustomDomain extends Model<InferAttributes<CustomDomain>, InferCreationAttributes<CustomDomain>> {
  // Use PrimaryKey, Default, Column decorators without IsUUID for compatibility
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id: string;

  @Index({ unique: true })
  @Column(DataType.STRING)
  hostname: string;

  @Index
  @Column({
    type: DataType.STRING,
    allowNull: false,
    comment: "Type of handler for this domain (e.g., 'map_view', 'default_app')",
  })
  handlerType: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    comment: "JSON configuration specific to the handler type",
  })
  handlerConfig: HandlerConfig | null;

  // Associations
  @ForeignKey(() => Team)
  @Index
  @Column(DataType.UUID)
  teamId: string | null;

  @BelongsTo(() => Team, "teamId")
  team: Team | null;
} 