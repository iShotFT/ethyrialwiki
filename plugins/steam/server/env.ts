import { IsOptional } from "class-validator";
import { Environment } from "@server/env";
import environment from "@server/utils/environment";
import { CannotUseWithout } from "@server/utils/validators";

class SteamPluginEnvironment extends Environment {
  /**
   * Steam API key. Optional for authenticating with Steam, but required for 
   * accessing additional Steam API endpoints.
   */
  @IsOptional()
  public STEAM_API_KEY = this.toOptionalString(environment.STEAM_API_KEY);
}

export default new SteamPluginEnvironment(); 