GameItem:
- uuid
- slug
- title
- description
- icon (references the 'GameIcon' model)
- public: boolean (default: true)
- dropable: boolean (default: true)
- rarity (references the 'GameItemRarity' model)
- onUseEffect: string nullable
- usedForSkill (references the 'GameSkill' model), nullable, default null
- gatheringSpeed: float nullable default null
- requiresSkill (references the 'GameSkill' model), nullable, default null
- reauiresSkillLevel: whole number default 0
- craftable: boolean (default: false)
- craftingSkill (references the 'GameSkill' model), nullable, default null
- craftingTier: whole number (default: 0)
- craftingXp: whole number (default: 0)
- itemCategory: is a many-to-many relationship with GameItemCategory
- itemModifiers: is a many-to-many relationship with GameSkill and has an extra property 'modifier' (whole number default 0) in the connecting table
- createdAt
- updatedAt
- deletedAt

GameItemCategory
- uuid
- slug
- title
- icon (references the 'GameIcon' model)
- public: boolean (default: true)
- createdAt
- updatedAt
- deletedAt

GameIcon:
- uuid
- title
- originalName
- path (references S3 path)
- public: boolean (default: true)
- createdAt
- updatedAt
- deletedAt

GameItemRarity:
- uuid
- slug
- title
- colorHex
- createdAt
- updatedAt
- deletedAt

GameSkill:
- uuid
- slug
- title
- description
- type: enum (COMBAT, DISCIPLINES, PROFESSION) nullable default null
- crafting: boolean (default: false)
- icon (references the 'GameIcon' model)
- createdAt
- updatedAt
- deletedAt




Ok, let's create a script that does:
- Uploads all of the .png files from tools\scripts\icons into S3 ( similar to how we did @upload-map-tiles.ts ), let's make sure they go into a separete folder called 'icons'
- There are a lot of icons in there that are icons of Ores, we are particularly interested in those, however the naming is not always consistent
   - I can see some that are <name-of-ore>_Ore_Icon.png
   - I can also see some that are <name-of-ore>Ore_Icon.png (without the underscore between name and the word 'Ore')
- There are a lot of icons in there that are icons of Bars, these are the ores but smelted
   - Same as the ores, <name-of-bar>_Bar_Icon.png and <name-of-bar>Bar_Icon.png
   - Aditionally, there are improved version of the bars like StrengthenedDrakoniumBar_Icon.png (Strengthened, Fortified, Mythical)

So, our goal is to create a uploader, but also a seeder for our newly introduced tables and models (similar to @seed-map.ts), we want to have all the uploaded icons stored in GameIcon and we want to create at least two categories:
Bars and Ores (select a random bar and ore icon respectively for the category picture)

Then we want to create a GameItem for each of the found bar and ore, these are item types that don't have a lot of extra attached relationships so keep the stuff you don't know as default value while seeding

We want to introduce the ability to store 'Blueprints' for items, a blueprint is effectively the recipe, the following is the structure I have in mind:

GameBlueprint:
- id (UUID, primary key)
- name (string, not null)
- width (integer, not null, 1-6)
- height (integer, not null, 1-5)
- outputItemId (UUID, not null, references GameItem)
- craftingSkill (references the 'GameSkill' model), nullable, default null
- craftingTier: whole number (default: 0)
- craftingXp: whole number (default: 0)
- createdAt (timestamp)
- updatedAt (timestamp)
- deletedAt (timestamp)

GameBlueprintSlot:
- id (UUID, primary key)
- blueprintId (UUID, not null, references Blueprint.id)
- x (integer, not null, 0-5)
- y (integer, not null, 0-4)
- itemId (UUID, nullable, references Items.id)
- createdAt (timestamp)
- updatedAt (timestamp)
- deletedAt (timestamp)

And let's rewrite the GameItem table because we've move some data to the blueprint setup

GameItem:
- uuid
- slug
- title
- description
- icon (references the 'GameIcon' model)
- public: boolean (default: true)
- dropable: boolean (default: true)
- rarity (references the 'GameItemRarity' model)
- blueprint (references the 'GameBlueprint' model), nullable, default null
- onUseEffect: string nullable
- usedForSkill (references the 'GameSkill' model), nullable, default null
- gatheringSpeed: float nullable default null
- requiresSkill (references the 'GameSkill' model), nullable, default null
- requiresSkillLevel: whole number default 0
- itemCategory: is a many-to-many relationship with GameItemCategory
- itemModifiers: is a many-to-many relationship with GameSkill and has an extra property 'modifier' (whole number default 0) in the connecting table
- createdAt
- updatedAt
- deletedAt


Item info:

Rarities:
None: White
Common: Gray
Uncommon: Green
Rare: Blue
Epic: Purple
Legendary: Orange
Relic: Redish
Quest Item: Yellow

Game Skills:
Category - Combat:
- Heavy Armor
- Light Armor
- Medium Armor
- Magic
- Ranged
- Melee
Category - Disciplines:
- Demonism
- Empyrean
Category - Profession:
- Alchemy
- Blacksmithing
- Cooking
- Enchanting
- Fishing
- Herbalism
- Jewelcrafting
- Leatherworking
- Mining
- Monster Hunting
- Research
- Skinning
- Trading
- Woodcutting
- Woodworking

Ores:

Tiers:
T1: Copper
T2: Silver, Iron
T3: Gold, Coal
T4: Platinum, Ethyrite
T5: Azurium, Palladium
T6: Mystril
T7: Crimsonite

Tier LVL requirements:
T1: at lvl 0 you have 100% chance
T2: same but lvl 5
T3: same but lvl 10
T4: same but lvl 15
T5: same but lvl 20
T6: same but lvl 25
T7: same but lvl 25

Rarity:
Mystril: Blue
Azurium: Green
Palladium: Blue
Ethyrite: Green
Gold: Green
Platinum: Blue
Silver: Green
Coal: Gray
Iron: Gray
Copper: Gray
Crimsonite: Blue