import { InferAttributes, InferCreationAttributes } from "sequelize";
import { Table, Column, DataType, Default, AllowNull, Unique, IsUUID, PrimaryKey, HasMany } from "sequelize-typescript";
import Model from "./base/Model";
import GameItem from "./GameItem";
import Fix from "./decorators/Fix";

@Table({ tableName: "game_item_rarities", modelName: "GameItemRarity", timestamps: true, paranoid: true })
@Fix
class GameItemRarity extends Model<InferAttributes<GameItemRarity>, InferCreationAttributes<GameItemRarity>> {
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
  @Column(DataType.STRING) // Assuming hex color
  colorHex: string;

  @AllowNull(true)
  @Column(DataType.STRING) // Nullable background color hex
  itemBackgroundColorHex: string | null;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder: number;

  // Associations
  @HasMany(() => GameItem, 'rarityId')
  items: GameItem[];
}

export default GameItemRarity; 