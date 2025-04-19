declare module 'passport-openid' {
  import { Strategy as PassportStrategy } from 'passport';
  
  export interface OpenIDStrategyOptions {
    returnURL: string;
    realm: string;
    providerURL?: string;
    stateless?: boolean;
    passReqToCallback?: boolean;
    profile?: boolean;
  }
  
  export class OpenIDStrategy extends PassportStrategy {
    constructor(
      options: OpenIDStrategyOptions,
      verify: (
        req: any,
        identifier: string, 
        profile: any, 
        done: (error: any, user?: any, info?: any) => void
      ) => void
    );
  }
} 