# Today and video Archive — DEV review, October 14

Owner requested DEV simulator review before mobile shipment, with only the
Archive loading correction shipped now. That bounded backend fix is live at
`db671c90f4ffa990ba2f6e59d7e4b85aaf21bb3d`. Full source, cause, privacy and
deployment evidence: canonical backend
`docs/release/ARCHIVE_TODAY_ACCESS_2026-10-14.md`.

Both athlete/self-coach Today now offer My Videos, Session History and Movement
History. My Videos opens Archive → Videos; tapping a video opens the existing
player, and closing it keeps the collection. All / Training / Videos / Meets
remain directly available within Archive. Direct video detail links also play.

Runtime observations used canonical Metro and local DEV, with fictional isolated
accounts and four-second local playback fixtures. No live customer data was
seeded or used for the UI review, and no product imagery was replaced.

- `01-today-initial.png` / `02-videos-initial.png`: initial runtime pass.
- `03-self-coach-video-player.png`: real native player rendering the local clip.
- `04-videos-final.png`: refined collection and direct playback affordance.
- `05-archive-overview.png`: repaired landing response rendered in the real app.
- `06-self-coach-today-final.png`: final three widgets.
- `07-session-history.png`: Session History opened through its widget.

The second pass improved uneven widget title wrapping, external-link icon
semantics, truncated search copy, duplicate back navigation and raw status /
false preview-failure messaging. No redesign of the existing Today hero or
history screens was undertaken.

Interaction tests run actual changed components and callbacks. They cover both
roles, all three routes, canonical video IDs, collection retention, Today and
workspace returns, server export policy, stale response rejection, direct
details and denied playback. `negative-controls.json` records two deliberately
broken candidates rejected by those same tests. The automatically discovered
accepted-behavior runner includes `test-today-archive-access.mjs`.

TypeScript, Home state/week, navigation, units and transparent roots pass.
The literal-value release audit intentionally remains unapproved for this draft
(six findings); no approval hash or exception was refreshed. Mobile is not
release-ready until the owner reviews the new UI and the scoped value review is
completed. Existing unrelated failures are listed in the backend report.

Mac locked after the self-coach visual pass. Athlete behavior was checked via
the actual shared component and real DEV HTTP endpoints. Movement History was
clicked but its destination could not receive a final visual check. DEV servers
and iPhone Air stay running; a Today deep link was sent, with final screen
observation unavailable while locked. This is a DEV handoff, not a claim of
mobile publication or full production device certification.
