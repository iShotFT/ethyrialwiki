# Ethyrial Source Code Directory Structure

The files and directories listed below actually exist, when trying to read them you can open them by using:
D:\Documents\Development\ethyrialwiki\ethyrialwiki\tools\scripts\source\Scripts\<relative-path>

You are meant to detect which files are important to the question you're currently solving and actually READ the files or list the files in the subfolder and read those.

## Core Game Files
- `Game.csproj` - Main project file
- `NetworkClient.cs` - Network communication implementation
- `LocalPlayerInput.cs` - Player input handling
- `LocalPlayerEntity.cs` - Local player entity implementation
- `LivingEntity.cs` - Base entity class
- `TileEngine.cs` - Tile and map system implementation
- `WorldPart.cs` - World partition system

## UI Components
- `CharacterWindow_Script.cs` - Character window UI
- `ChatPanelScript.cs` - Chat system UI
- `QuestLogWindow.cs` - Quest log interface
- `QuestTracker.cs` - Quest tracking system
- `UnitFrame.cs` - Unit information display
- `UI_Window.cs` - Base window class
- `WindowTransparencyController.cs` - Window transparency control

## Game Systems
- `Party.cs` - Party system
- `PartyGroup.cs` - Party group management
- `QuickSlot.cs` - Quick slot system
- `QuickBar.cs` - Quick bar implementation
- `SpellSlot.cs` - Spell slot system
- `ItemSlot.cs` - Item slot system
- `CraftSlot.cs` - Crafting system
- `TradingPostWindow.cs` - Trading post system
- `PlayerTradeWindow.cs` - Player trading system

## Character and Items
- `Costume.cs` - Character costume system
- `ModularCharacter.cs` - Modular character system
- `CharacterAttribute_Item.cs` - Character attributes
- `ItemInfoBarScript.cs` - Item information display

## Network and Data
- `LoginNetwork.cs` - Login system
- `LoginNetworkTypes.cs` - Login network types
- `ServerInfo.cs` - Server information
- `Data.cs` - Data structures
- `SerializedWorldSliceInfo.cs` - World slice serialization

## Third-Party Directories
- `Assets/` - Game assets
- `AlmostEngine/` - Engine components
- `UnityStandardAssets/` - Unity standard assets
- `TMPro/` - TextMesh Pro
- `StylizedWaterShader/` - Water shader
- `SoftMasking/` - UI masking
- `SkeletonEditor/` - Skeleton editor
- `PolyAndCode/` - Polygon code
- `PilotoStudio/` - Studio tools
- `NHance/` - Enhancement tools
- `MEC/` - Multi-threading
- `MalbersAnimations/` - Animation system
- `MagicArsenal/` - Magic system
- `LavaSurface/` - Lava effects
- `KevinIglesias/` - Additional tools
- `HoaxGames/` - Game components
- `GuildUI/` - Guild interface
- `Evereal/` - Real-time effects
- `EPOOutline/` - Outline system
- `EpicToonFX/` - Toon effects
- `Enviro/` - Environment system
- `DuloGames/` - Game components
- `DigitalRuby/` - Ruby tools
- `DG/` - Development tools

## Generated Files
- `UnitySourceGeneratedAssemblyMonoScriptTypes_v1.cs` - Unity generated types
- `-PrivateImplementationDetails-.cs` - Private implementation details
