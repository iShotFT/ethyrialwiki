// Declaration file to augment koa-helmet ContentSecurityPolicyDirectives
// This extends the existing type to include the workerSrc directive
import 'koa-helmet';

declare module 'koa-helmet' {
  interface KoaHelmetContentSecurityPolicyDirectives {
    workerSrc?: string[];
  }
} 