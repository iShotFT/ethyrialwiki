import { InferAttributes, InferCreationAttributes } from "sequelize";
import { Table, Column, DataType, Default, AllowNull, Unique, PrimaryKey, HasMany } from "sequelize-typescript";
import Model from "./base/Model";
import GameSkill from "./GameSkill";
import GameItemCategory from "./GameItemCategory";
import GameItem from "./GameItem";
import Fix from "./decorators/Fix";

@Table({ tableName: "game_icons", modelName: "GameIcon", timestamps: true, paranoid: true })
@Fix
class GameIcon extends Model<InferAttributes<GameIcon>, InferCreationAttributes<GameIcon>> {
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

  @AllowNull(true)
  @Column(DataType.STRING)
  originalName: string | null;

  @AllowNull(false)
  @Column(DataType.STRING)
  path: string;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  public: boolean;

  // Associations
  @HasMany(() => GameSkill, 'iconId')
  skills: GameSkill[];

  @HasMany(() => GameItemCategory, 'iconId')
  itemCategories: GameItemCategory[];

  @HasMany(() => GameItem, 'iconId')
  items: GameItem[];
}

export default GameIcon; 