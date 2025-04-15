import { Table, Column, DataType, ForeignKey } from "sequelize-typescript";
import Model from "./base/Model";
import GameItem from "./GameItem";
import GameItemCategory from "./GameItemCategory";
import Fix from "./decorators/Fix";

@Table({ tableName: "game_item_item_categories", modelName: "GameItemItemCategory", timestamps: true })
@Fix
class GameItemItemCategory extends Model<GameItemItemCategory> {

  @ForeignKey(() => GameItem)
  @Column(DataType.UUID)
  gameItemId: string;

  @ForeignKey(() => GameItemCategory)
  @Column(DataType.UUID)
  gameItemCategoryId: string;
}

export default GameItemItemCategory; 