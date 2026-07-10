# Licensing and third-party notices

This repository contains evidence prose, generated example applications, and one upstream tutorial
application. The applicable terms are:

| Material                                                                                                                     | License                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Root documentation, campaign summaries, manifests, curated `.aidd` evidence, commit ledgers, and transcript metadata/archive | Creative Commons Attribution 4.0 International |
| `proofs/a-fresh-habit-tracker/source/`                                                                                       | MIT                                            |
| `proofs/b-template-kanban-board/source/`                                                                                     | MIT                                            |
| `proofs/c-spernakit-smb-dashboard/source/`                                                                                   | Its included MIT `LICENSE`                     |
| `proofs/d-existing-flaskr/source/`                                                                                           | Its included Pallets BSD `LICENSE.txt`         |

## Flaskr

The Flaskr source snapshot began from the official Flask tutorial application maintained by the
Pallets project. Its BSD license and copyright notice are preserved in
`proofs/d-existing-flaskr/source/LICENSE.txt`.

## Generated applications

Habit Tracker and Kanban Board were generated and developed during the AIDD campaign. They did not
carry standalone license files at their recorded commits, so the repository-level MIT license
applies to those source directories.

The SMB Infrastructure Dashboard was generated from Spernakit and already carried an MIT license at
its recorded commit. That file is preserved unchanged in the source snapshot.

Dependency lockfiles identify third-party packages used by each application. Those packages remain
subject to their own licenses; this repository does not relicense them.
