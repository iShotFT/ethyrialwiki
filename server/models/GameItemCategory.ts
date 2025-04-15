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
} from "sequelize-typescript";
import Model from "./base/Model";
import GameIcon from "./GameIcon";
import GameItem from "./GameItem";
import GameItemItemCategory from "./GameItemItemCategory"; // Join table model
import Fix from "./decorators/Fix";

// Define the Enum for Display Group
export enum DisplayGroup {
  HEATMAP = 'HEATMAP',
}

@Table({ tableName: "game_item_categories", modelName: "GameItemCategory", timestamps: true, paranoid: true })
@Fix
class GameItemCategory extends Model<InferAttributes<GameItemCategory>, InferCreationAttributes<GameItemCategory>> {
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

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  public: boolean;

  // Add displayGroup column
  @AllowNull(true)
  @Default(null)
  @Column(DataType.ENUM(...Object.values(DisplayGroup)))
  displayGroup: DisplayGroup | null;

  // Associations
  @ForeignKey(() => GameIcon)
  @AllowNull(true)
  @Column(DataType.UUID)
  iconId: string | null;

  @BelongsTo(() => GameIcon, "iconId")
  icon: GameIcon | null;

  @BelongsToMany(() => GameItem, () => GameItemItemCategory)
  items: GameItem[];
}

export default GameItemCategory; 