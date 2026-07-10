# SMB Infrastructure Dashboard

## Overview

SMB Infrastructure Dashboard is a self-hosted application for small and midsize
businesses to inventory infrastructure assets and understand how those assets relate
to each other. The app answers practical operational questions for management and
staff: what servers exist, which are physical hosts or virtual machines, what storage
and memory they have, what roles they serve, which services and ports they expose,
and what other assets depend on them.

The product is not a monitoring platform or a replacement for a CMDB. It is a clear,
maintainable infrastructure map that makes server, network, storage, and service
relationships visible to non-specialists while preserving enough detail for IT staff to
troubleshoot and plan changes.

## Intended Users

- **Management / owners:** review asset counts, critical systems, ownership, lifecycle
  risk, and business impact without needing low-level administration access.
- **IT managers:** maintain asset accountability, service ownership, lifecycle status,
  virtualization coverage, and documentation completeness.
- **Sysadmins / operators:** add and update infrastructure records, map dependencies,
  review open ports and services, and identify affected systems before changes.
- **Help desk / staff viewers:** look up where a business service runs, who owns it,
  and what systems are related.
- **Auditors / external support viewers:** receive read-only filtered access to asset
  facts, change history, and service exposure without seeing secrets.

## Primary Goals

1. Maintain a searchable inventory of servers, virtual machines, storage, network
   devices, services, and infrastructure roles.
2. Show relationships among assets, including host-to-VM, service-to-server,
   dependency, storage attachment, network connection, and business-owner mappings.
3. Provide a dashboard that summarizes infrastructure shape, coverage, staleness, and
   risk signals for management.
4. Provide detailed asset pages that expose basic hardware, OS, network, service, port,
   and relationship facts in one place.
5. Support safe manual curation first, with import-assisted updates that never overwrite
   important human-entered context without review.

## Non-Goals

- Do not store passwords, private keys, shared secrets, or privileged credentials.
- Do not perform credentialed network discovery in MVP.
- Do not attempt real-time monitoring, alerting, log aggregation, patch management, or
  remote administration in MVP.
- Do not expose raw vulnerability-scanner output as a substitute for curated asset facts.
- Do not require cloud services for core operation.

## Technology Baseline

Assume the standard Spernakit v3 stack unless a project override says otherwise:

- Backend: Bun, Elysia, TypeScript, Drizzle ORM, TypeBox route validation, pino logging.
- Frontend: React 19, Vite, React Router, TanStack Query, Zustand, shadcn/ui, lucide.
- Database: SQLite by default, with data files under the project root `data/` directory.
- Configuration: JSON-only config files; no `.env` files.
- API: versioned REST endpoints under `/api/v1`, with OpenAPI available in development.
- Quality gate: `bun run smoke:qc`; UI work also requires targeted crawl testing.

## Core Concepts

### Asset

An asset is any infrastructure item worth tracking. Assets have a type, status, owner,
location, lifecycle metadata, tags, notes, and update history.

Required asset types:

- Physical server
- Virtual machine
- Hypervisor host
- Storage appliance
- Storage pool or volume
- Network device
- Firewall or router
- Application or service endpoint
- Business service
- Backup target
- Other infrastructure component

### Relationship

A relationship explains how two assets are connected. Relationships are first-class
records with a type, direction, confidence, notes, and timestamps.

Required relationship types:

- `runs_on`: virtual machine runs on a host.
- `hosts`: host provides compute capacity to VMs.
- `depends_on`: service or asset requires another asset.
- `provides_service`: asset provides a named service.
- `connects_to`: asset connects to another asset over a known protocol or port.
- `stores_on`: VM, service, or server uses a storage pool or volume.
- `backs_up_to`: asset is backed up to a backup target.
- `part_of`: asset belongs to a site, rack, cluster, or business service.
- `owned_by`: asset or service is accountable to a person, team, or vendor.

### Service

A service is a capability provided by an asset, such as Active Directory, DNS, DHCP,
file sharing, database hosting, application hosting, print services, backup, VPN, or
monitoring. Services may have ports, protocols, URLs, owners, dependencies, and
business criticality.

### Port Exposure

Port records document expected open ports and observed open ports. Each port includes
protocol, port number, service name, scope, exposure level, source, verification date,
and notes. The app should distinguish expected documentation from imported scan
observations.

## Functional Requirements

### Dashboard

- Show total asset counts by type, status, site, owner, and criticality.
- Show physical versus virtual server breakdown.
- Show virtualization summary: hosts, VMs, orphan VMs, host capacity fields, and VM
  placement completeness.
- Show storage summary: storage appliances, pools, volumes, used capacity, free
  capacity, and assets depending on each pool.
- Show memory and CPU summary for servers and VMs where data is available.
- Show top business services and their backing infrastructure.
- Show documentation health: stale assets, missing owner, missing backup status,
  missing relationship map, missing service role, and unverified port data.
- Show risk cues: internet-exposed services, unknown ports, unsupported operating
  systems, critical assets without backups, and assets with no owner.
- Provide saved dashboard filters for management view, operations view, and audit view.

### Asset Inventory

- Provide a searchable, filterable asset list with columns for name, type, status,
  site, owner, role, OS, IP addresses, virtualization state, last verified date, and
  criticality.
- Support create, read, update, soft delete, restore, and archive flows for assets.
- Support bulk tagging and bulk lifecycle/status updates.
- Support manual asset entry with validation for required fields and duplicate names.
- Track asset aliases, hostnames, FQDNs, serial numbers, asset tags, and management URLs.
- Track lifecycle fields: status, purchase date, warranty date, support end date,
  planned replacement date, and decommission date.
- Track ownership fields: business owner, technical owner, vendor, support contact, and
  documentation link.

### Asset Details

- Provide a dedicated asset detail page with tabs or sections for overview, hardware,
  virtualization, storage, network, services, ports, relationships, notes, and history.
- Show the asset's upstream and downstream dependencies.
- Show related business services and impact if the asset is offline.
- Show services provided by the asset and ports associated with each service.
- Show interface and addressing data: MAC, IP, subnet, VLAN, DNS name, and network zone.
- Show server resources: CPU model/count, RAM, disk/storage allocation, OS, platform,
  hypervisor, and hardware model where applicable.
- Show VM-specific data: guest OS, vCPU, vRAM, virtual disks, host, cluster, tools
  status, and snapshot notes.
- Show physical-host data: chassis/model, serial, host role, cluster, VM count, total
  RAM, total storage, and assigned VMs.

### Relationship Map

- Provide an interactive infrastructure map for selected scopes such as all assets,
  one site, one business service, one host, or one asset dependency tree.
- Use distinct node styling for asset types and relationship types.
- Allow graph filtering by type, owner, site, criticality, status, and relationship type.
- Allow expanding an asset to one-hop or multi-hop dependencies.
- Provide a table fallback for users who prefer structured relationship lists.
- Provide impact analysis from any asset: what depends on this asset, what this asset
  depends on, and which business services are affected.
- Prevent duplicate relationships and prevent nonsensical relationships, such as a
  storage pool running on a VM unless explicitly marked as special/custom.

### Services and Ports

- Maintain a service catalog with service name, category, owner, criticality, expected
  availability, business purpose, and backing assets.
- Assign one or more services to an asset.
- Track service dependencies on other services and infrastructure assets.
- Track expected ports for each service and actual observed ports for each asset.
- Mark ports as expected, unexpected, ignored, historical, or needs review.
- Allow operators to document why a port is open and which service owns it.
- Filter assets by service, protocol, port number, exposure level, or review status.

### Import and Review

- Support CSV import for assets, services, ports, and relationships.
- Support staged import review before records are created or updated.
- Detect duplicate assets by hostname, FQDN, IP address, serial number, and asset tag.
- Preserve manually entered ownership, notes, lifecycle, and relationship context unless
  the operator explicitly accepts an import update.
- Record import source, import time, row count, accepted changes, rejected changes, and
  warnings.
- Provide export to CSV and JSON for asset lists, relationship lists, services, ports,
  and dashboard summaries.

### Search and Reporting

- Provide global search across assets, hostnames, IPs, services, ports, owners, tags,
  notes, and aliases.
- Provide saved filtered views for common questions:
    - What servers do we have?
    - Which servers are virtual machines?
    - Which VMs run on this host?
    - Which services run on this server?
    - What ports are open on this asset?
    - What breaks if this asset is offline?
    - Which assets have stale or incomplete documentation?
- Provide printable/exportable management summaries.
- Provide audit-friendly reports for changes, ownership gaps, exposed ports, and asset
  lifecycle status.

### Administration

- Use Spernakit authentication and role-based access control.
- Define read-only, operator, manager, admin, and sysop access patterns using the
  existing role hierarchy.
- Audit all create, update, delete, import, relationship, service, and port changes.
- Provide settings for required asset fields, default stale-data thresholds, default
  dashboard filters, and import behavior.
- Support workspace scoping if enabled by the base application.

## Data Model Requirements

The implementation should include at least these domain entities:

- `assets`
- `asset_aliases`
- `asset_hardware_profiles`
- `asset_network_interfaces`
- `asset_storage_allocations`
- `asset_relationships`
- `asset_services`
- `service_catalog`
- `service_dependencies`
- `asset_ports`
- `sites`
- `network_zones`
- `owners`
- `vendors`
- `asset_tags`
- `imports`
- `import_rows`
- `asset_change_events`

All tables must use snake_case database names and camelCase TypeScript fields. Domain
records should include created/updated timestamps, actor IDs where appropriate, and
soft-delete fields where records may be hidden without losing history.

## Suggested AIDD Feature Backlog

Use these feature IDs and titles as the initial SDLC decomposition:

1. `asset-domain-schema` - Asset domain schema and migrations.
2. `asset-inventory-api` - Asset CRUD and list API.
3. `asset-inventory-page` - Searchable asset inventory page.
4. `asset-detail-page` - Asset detail overview and tabbed sections.
5. `hardware-profile-tracking` - Server, VM, CPU, RAM, OS, and lifecycle fields.
6. `network-interface-tracking` - IP, MAC, subnet, VLAN, DNS, and zone records.
7. `storage-tracking` - Storage appliance, pool, volume, allocation, and capacity data.
8. `relationship-model` - Directed asset relationship records and validation.
9. `relationship-map-view` - Interactive dependency and topology map.
10. `relationship-table-view` - Accessible table fallback for relationships.
11. `service-catalog` - Business and technical service catalog.
12. `asset-service-assignment` - Assign services and roles to assets.
13. `port-exposure-tracking` - Expected and observed ports by asset and service.
14. `dashboard-summary-cards` - Management dashboard summary cards.
15. `documentation-health` - Staleness, missing-owner, missing-backup, and gap signals.
16. `impact-analysis` - Upstream and downstream dependency impact view.
17. `global-search` - Cross-domain search across assets, services, IPs, and ports.
18. `saved-views` - Reusable filtered views for management, operations, and audit.
19. `csv-import-review` - Staged CSV import with duplicate detection and review.
20. `export-reports` - CSV/JSON exports and management summaries.
21. `audit-change-history` - Asset, relationship, service, and import audit trails.
22. `role-permission-model` - Role-specific visibility and edit capabilities.
23. `admin-settings` - Required fields, stale thresholds, and import policy settings.
24. `workspace-scoping` - Workspace-aware asset boundaries where enabled.
25. `testing-scenarios` - End-to-end crawl scenarios for dashboard and inventory flows.

## Milestone Plan

### MVP

- Asset schema, asset inventory API, asset list, asset detail, basic hardware/VM fields.
- Manual relationship records and relationship table view.
- Service assignment and expected port tracking.
- Management dashboard summary cards.
- Documentation health indicators.
- CSV export.
- RBAC and audit logging for all asset changes.

### v1.0

- Interactive relationship map.
- Storage capacity tracking.
- Network interface and zone tracking.
- Global search and saved views.
- Impact analysis for asset and service dependencies.
- CSV import review workflow.
- Management and audit report exports.

### v1.1

- Observed port import from CSV/Nmap-style exports.
- Duplicate detection improvements.
- Lifecycle planning reports.
- Richer dashboard filters and saved dashboard presets.
- Workspace-scoped infrastructure inventories where needed.

## UX Requirements

- The first screen after login should be the operational dashboard, not a marketing page.
- The design should feel like a quiet operations tool: dense, scannable, restrained, and
  optimized for repeated use.
- The asset list must support fast filtering and comparison without opening every asset.
- The asset detail page must make the asset type, role, owner, service, and criticality
  visible immediately.
- Relationship visuals must never be the only way to inspect dependency data; every graph
  result needs a table/list equivalent.
- Use icons for asset types, service categories, relationship direction, import status,
  and port review state.
- Avoid showing raw technical jargon without labels that help managers understand impact.

## Security and Privacy Requirements

- Do not store infrastructure secrets.
- Treat internal IP addresses, topology, service exposure, and ownership records as
  sensitive operational data.
- Enforce role checks on every backend route and frontend route.
- Audit every write operation and import decision.
- Prevent low-privilege users from seeing restricted notes, management URLs, or support
  contacts when permissions do not allow it.
- Validate all import data server-side before staging or applying changes.
- Mark internet-exposed or unknown ports for review without claiming they are
  vulnerabilities.

## Acceptance Criteria

- A manager can answer "what servers do we have?" from the dashboard and asset list.
- An operator can open a server and see whether it is physical or virtual, its RAM,
  storage, OS, owner, site, services, ports, and related assets.
- An operator can trace which VMs run on a host and which business services depend on a
  VM.
- A viewer can inspect relationships and service ownership without editing records.
- An admin can import a CSV, review staged changes, accept selected updates, and see an
  audit trail of the import.
- The dashboard clearly flags stale, unowned, unbacked-up, or undocumented assets.
- Unexpected or unreviewed ports are visible as review items, not hidden in raw notes.
- All backend routes are registered, typed, validated, and covered by frontend callers.
- `bun run smoke:qc` passes before the app is considered working.

## Open Questions for Product Owner

1. Should MVP include only manual records and CSV imports, or should it include a passive
   network scan import format?
2. Which asset types are mandatory on day one for the target SMB environment?
3. Should management reports be printable HTML, CSV/JSON only, or both?
4. Should users be allowed to mark some assets or notes as restricted to ADMIN+?
5. Are workspaces needed for multiple customers/sites, or is a single inventory enough?
6. What is the default stale-data threshold: 30, 60, 90, or 180 days?
7. Which business-critical services should be seeded as examples: AD, DNS, DHCP, file
   share, backup, VPN, database, line-of-business app, print, monitoring?
