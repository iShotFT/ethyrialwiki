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