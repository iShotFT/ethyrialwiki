import { Table, Column, DataType, ForeignKey, AllowNull, Default } from "sequelize-typescript";
import Model from "./base/Model";
import GameItem from "./GameItem";
import GameSkill from "./GameSkill";
import Fix from "./decorators/Fix";

@Table({ tableName: "game_item_modifiers", modelName: "GameItemModifier", timestamps: true })
@Fix
class GameItemModifier extends Model<GameItemModifier> {

  @ForeignKey(() => GameItem)
  @Column(DataType.UUID)
  gameItemId: string;

  @ForeignKey(() => GameSkill)
  @Column(DataType.UUID)
  gameSkillId: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  modifier: number;
}

export default GameItemModifier; 