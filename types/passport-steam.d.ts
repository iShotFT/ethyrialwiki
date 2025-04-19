declare module 'passport-steam' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface Profile {
    id: string;
    displayName: string;
    photos?: Array<{
      value: string;
    }>;
    provider: string;
    _json: {
      steamid: string;
      communityvisibilitystate: number;
      profilestate: number;
      personaname: string;
      profileurl: string;
      avatar: string;
      avatarmedium: string;
      avatarfull: string;
      avatarhash: string;
      lastlogoff: number;
      personastate: number;
      realname?: string;
      primaryclanid?: string;
      timecreated?: number;
      personastateflags?: number;
      loccountrycode?: string;
      locstatecode?: string;
      loccityid?: number;
    };
  }

  export interface StrategyOptions {
    returnURL: string;
    realm: string;
    apiKey?: string;
    profile?: boolean;
    passReqToCallback?: boolean;
  }

  export type VerifyCallback = (
    err: Error | null,
    user?: any,
    info?: any
  ) => void;

  export type VerifyFunction = (
    identifier: string,
    profile: Profile,
    done: VerifyCallback
  ) => void;

  export type VerifyFunctionWithReq = (
    req: any,
    identifier: string,
    profile: Profile,
    done: VerifyCallback
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(
      options: StrategyOptions,
      verify: VerifyFunction | VerifyFunctionWithReq
    );
    name: string;
    authenticate(req: any, options?: any): void;
  }
} 