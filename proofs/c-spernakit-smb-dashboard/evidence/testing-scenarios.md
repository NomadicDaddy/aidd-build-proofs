# Testing Scenarios — SMB Infrastructure Dashboard

The SMB Infrastructure Dashboard is a self-hosted operations tool that inventories
infrastructure assets and makes their relationships visible: what servers exist, which are
physical hosts or virtual machines, what storage, memory, services, and ports they expose,
and what depends on them. These scenarios exercise the primary end-user flows for
management, operators, and viewers, plus the acceptance-criteria questions from the spec.

**Environment notes:** Dev seed users are `sysop`, `admin`, `manager`, `operator`, and
`viewer`, each with password `{username}123` (e.g. `operator123`). Seeded domain data
includes sites (Headquarters, Primary Data Center), owners (IT Operations, Management), and a
starter service catalog (Active Directory, DNS, DHCP, File Sharing, Backup, VPN, Database);
assets are created during the flows below. The post-login landing screen is the operational
dashboard at `/dashboard`.

## Scenarios

1. `/spernakit-tester smb-infrastructure-dashboard: I want to log in as operator, land on the operational dashboard at /dashboard, and confirm the summary cards show total asset counts by type, status, site, owner, and criticality with the physical-versus-virtual server breakdown, all rendering real numbers with no console errors.`
2. `/spernakit-tester smb-infrastructure-dashboard: I want to open the dashboard and verify the risk-cue and documentation-health signals — internet-exposed services, unknown ports, unsupported OS, critical assets without backups, stale assets, and unowned assets — each surface as a card that links through to a filtered list view.`
3. `/spernakit-tester smb-infrastructure-dashboard: I want to answer "what servers do we have?" by opening the asset inventory at /assets, scanning the dense table of name, type, status, site, owner, role, OS, IP, virtualization state, last verified, and criticality, and applying a fast text filter plus a type filter without any console errors.`
4. `/spernakit-tester smb-infrastructure-dashboard: I want to create a new physical server asset from the inventory page with required fields and a unique name, confirm duplicate-name and validation errors are rejected, then edit it and soft-delete it from the list.`
5. `/spernakit-tester smb-infrastructure-dashboard: I want to open a server's asset detail page and confirm its type, role, owner, service, and criticality are visible immediately in the header, then walk every section — overview, hardware, virtualization, storage, network, services, ports, relationships, notes, and history — and confirm each renders its data.`
6. `/spernakit-tester smb-infrastructure-dashboard: I want to open an asset and verify the server-resource facts an operator needs — CPU, RAM, disk/storage allocation, OS, platform, hypervisor, and hardware model — plus VM-specific data (guest OS, vCPU, vRAM, host, cluster) where the asset is a virtual machine.`
7. `/spernakit-tester smb-infrastructure-dashboard: I want to add a network interface to an asset with MAC, IP, subnet, VLAN, DNS name, and network zone, then confirm the addressing data appears on the asset detail Network section.`
8. `/spernakit-tester smb-infrastructure-dashboard: I want to add a storage allocation to a storage-pool asset, confirm used capacity cannot exceed total capacity, then open a consuming asset and verify the pool relationship and the "assets depending on this pool" consumer list.`
9. `/spernakit-tester smb-infrastructure-dashboard: I want to create a runs_on relationship between a VM and a hypervisor host, confirm duplicate and nonsensical relationships are prevented, then trace from the host which VMs run on it using the relationship table view at /relationships.`
10. `/spernakit-tester smb-infrastructure-dashboard: I want to open the interactive relationship map at /relationships/map, filter the graph by type, owner, site, criticality, and relationship type, expand an asset to its one-hop and multi-hop dependencies, and confirm the table fallback shows the same relationships.`
11. `/spernakit-tester smb-infrastructure-dashboard: I want to run impact analysis from a business-critical asset and confirm it answers "what breaks if this asset is offline?" by listing what depends on it, what it depends on, and which business services are affected.`
12. `/spernakit-tester smb-infrastructure-dashboard: I want to open the service catalog at /services, review a seeded service like Active Directory with its category, owner, criticality, and backing assets, then assign that service with a role label to a server and confirm it appears on both the service page and the asset detail Services section.`
13. `/spernakit-tester smb-infrastructure-dashboard: I want to document expected and observed ports on an asset with protocol, port number, service name, scope, and exposure level, mark a port as needs-review, and filter assets by protocol, port number, exposure level, and review status.`
14. `/spernakit-tester smb-infrastructure-dashboard: I want to use global search at /search to find an asset across hostnames, IPs, services, ports, owners, tags, notes, and aliases, then jump from a result straight to the matching asset or service detail page.`
15. `/spernakit-tester smb-infrastructure-dashboard: I want to open the Views control on the inventory page, apply a built-in saved view such as "physical servers" or "internet-exposed ports", then save the current filters as a named personal view and re-apply it later.`
16. `/spernakit-tester smb-infrastructure-dashboard: I want to log in as admin, import a CSV of assets at /imports, review the staged rows with duplicate detection by hostname/FQDN/IP/serial/tag, accept selected changes while rejecting others, and confirm rejected rows never mutate existing records and the import is recorded with an audit trail.`
17. `/spernakit-tester smb-infrastructure-dashboard: I want to export assets, relationships, services, ports, and a dashboard summary to CSV and JSON from the reports area, open the printable management summary at /reports/summary, and confirm the exported data is correct and permission-filtered.`
18. `/spernakit-tester smb-infrastructure-dashboard: I want to make several asset, relationship, service, and port edits, then open the audit report and the per-asset history section and confirm every write produced an entry with actor, action, target, and metadata.`
19. `/spernakit-tester smb-infrastructure-dashboard: I want to log in as admin, adjust the infrastructure settings — required asset fields, the default stale-data threshold, default dashboard filters, and import behavior — and confirm the changes take effect across the dashboard staleness signals and the inventory create flow.`
20. `/spernakit-tester smb-infrastructure-dashboard: I want to log in as sysop and verify full-access administration — reaching the Users and Roles settings tabs, the system health, scheduled tasks, audit logs, and backup tabs — actions the lower tiers cannot reach.`
21. `/spernakit-tester smb-infrastructure-dashboard: I want to log in as manager and confirm I can review asset counts, critical systems, ownership, lifecycle risk, and reports across the app while the SYSOP-only user and role administration tabs remain out of reach.`
22. `/spernakit-tester smb-infrastructure-dashboard: I want to log in as operator and confirm I can create and update assets, map relationships, assign services, edit ports, and run a CSV import, while I cannot reach the SYSOP-only system and user administration areas.`
23. `/spernakit-tester smb-infrastructure-dashboard: I want to log in as viewer and confirm read-only access — I can inspect assets, relationships, service ownership, ports, and reports, but every create, edit, delete, assign, and import control is hidden or disabled.`
24. `/spernakit-tester smb-infrastructure-dashboard: I want to confirm the operator end-to-end acceptance flow: open a server, see whether it is physical or virtual with its RAM, storage, OS, owner, site, services, ports, and related assets, then trace which VMs run on its host and which business services depend on it.`

---

## Post-Test Procedure

- /bug2feature smb-infrastructure-dashboard
- delete the ingested bugs from bugs.json files (delete them if only placeholder or tests remain)
- /feature-review smb-infrastructure-dashboard
- iterate through remediation features created, resolving all issues and ensuring fixes applied intelligently to template as applicable
- delete remediation features resolved
- create session report (include time taken for each step among details)
