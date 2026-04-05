# Changelog

All notable changes to Shiojiri Rainbow Seeker Backend will be documented in this file.

## [1.6.0.0] - 2026-04-05

### Changed
- Upgraded Rails from 8.0.4 to 8.1.3 with PostGIS adapter 11.1.1
- Schema dumps now use Rails 8.1 alphabetical column ordering

### Fixed
- Maps, clusters, and trends endpoints returning 500 errors due to Solid Cache misconfiguration (cache database not specified for dev/test environments)
- Auth login crashing with NoMethodError when email or password is nil/blank
- Docker entrypoint now safely checks if auxiliary databases (cache, queue, cable) are initialized before loading schemas, preventing data loss on container restarts
