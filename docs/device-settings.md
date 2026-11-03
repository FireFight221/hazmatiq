# Device settings

Settings are saved immediately in `emergenz.preferences.v1` on the current browser.
They contain preferences only, are validated on read/import, and synchronize with
other tabs on that same browser. They do not change another device's preferences
or overwrite incident records. If storage fails, the previous settings remain
active and the page reports the failure.

| Control | Default | Effect |
| --- | --- | --- |
| Device GPS | Enabled | Allows requests through the shared location service. Disabling also rejects cached/in-flight fixes. Browser permission and HTTPS remain required. |
| Automatic GPS | Enabled | Clock/startup, Command/Plume location fallback, and Live Map startup may request GPS when appropriate. Explicit GPS buttons still work when automatic GPS is off. |
| High accuracy | Enabled | Requests high accuracy from browser GPS; clears the short location cache when changed. The browser determines actual accuracy. |
| Weather refresh | 5 minutes | Sets the visible-page/background header weather refresh interval to 5 or 15 minutes, or manual only. Opening a page and explicit refresh/import actions still work. Hidden tabs do not poll weather. Source age checks are unchanged. |
| Live Map view | Remember last | Uses the last saved style, or selects Satellite/Street on map creation. Changing this preference applies to an already-created Live Map. Page controls can still change the view during use. |
| Monitor placement GPS | Enabled | Enables an explicit device GPS button on the deployment dialog. Requires confirmation that the device is at the actual monitor position. Coordinates remain editable and must be saved. No remote tracking is implied. |
| New reading report inclusion | Enabled | Defaults new manual monitor entries to inclusion; each reading can override this. Historical entries are unchanged. |
| Print saved plume map | Enabled | Includes the saved image in printed incident briefs. Disabling hides the image, retaining threat zone tables. |
| Print Prepared By | Disabled | Adds the incident report's saved author footer to printed briefs. Does not invent a signature or change FEMA PDFs. |
| ICS PDF action | New tab | Opens the populated editable FEMA PDF in a tab or downloads the same bytes. Browser print settings remain authoritative. |

The station-weather shortcut opens the existing Columbia CSV importer in the
Plume workspace without triggering location/weather initialization. Existing
CSV parsing, observation-time and unit checks still apply. Changing Settings does
not invent station connections or replace model inputs silently.

Export/import affects only the allowlisted preferences. Imports are restricted to
16 KB and the EMERGENZ preferences format/version, and require confirmation.
Restore Defaults also requires confirmation and leaves incidents, monitor
placements, stored maps, and appearance untouched. Theme selection remains in
its existing appearance controls.

Authentication, provider credentials, Tier II dataset imports, and persistent
server database configuration remain server/agency administration, rather than
browser preferences.
