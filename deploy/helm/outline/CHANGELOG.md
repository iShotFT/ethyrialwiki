# Changelog

## 0.2.0 (2025-04-05)

### Major Improvements

- Fixed issues with service connectivity and service discovery
- Added proper support for WebSockets in the Nginx ingress controller
- Added customizable health probe settings tuned for Outline's startup behavior
- Added volume permissions for PostgreSQL and Redis
- Improved environment variable handling with more structured sections
- Enhanced DNS resolution through init containers

### Fixed

- Corrected service name references in deployment templates
- Fixed issue with web pods not passing health checks due to timing
- Fixed storage class references in PostgreSQL and Redis configurations
- Added proper handling of COLLABORATION_URL environment variable

### Documentation

- Added comprehensive troubleshooting section to README
- Added documentation about WebSocket support
- Added Discord authentication configuration documentation
- Improved environment variable documentation

## 0.1.0 (Initial Release)

- Initial Helm chart for Outline Wiki
- Support for PostgreSQL and Redis dependencies
- Ingress configuration
- Basic documentation
