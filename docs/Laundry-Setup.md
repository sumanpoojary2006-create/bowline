# Laundry dashboard

Admin: `/admin/laundry`. Staff: `/employee/laundry`. Existing Bowline logins apply; only admins can edit stock or retry sheet sync.

The initial quantities were transcribed from the supplied October 30 image. Admin can add more inventory types and correct the total count at any time.

Staff can only enter Send and Received quantities. In-house stock = admin total stock − sent + received. Received cannot exceed sent, and no quantity can exceed the total configured by admin. The admin total remains hidden from the staff interface. The staff name is required in the confirmation dialog. The authenticated user ID is also recorded.

Each submission is a complete snapshot against the current admin baseline, not an incremental stock movement. For another count, enter cumulative laundry counts against that same baseline, or have an admin update the baseline first. Submissions do not change admin stock automatically. Dates use India time and are assigned by the server. Recent history shows the latest 20 submissions; older records remain stored.

## Connect Google Sheets

1. Use the same Google Spreadsheet and Apps Script project already used by the main website.
2. Update that project's code with `sheets/BowlineSync.gs`. The new `upsertLaundry` action writes dated `Laundry YYYY-MM-DD` tabs alongside the existing booking tabs.
3. Update the existing web app deployment to a new version, keeping its `/exec` URL and permissions.
4. No new backend credentials are required: laundry reuses `APPS_SCRIPT_WEB_APP_URL` and `APPS_SCRIPT_OUTBOUND_SECRET` (or `SHEETS_WEBHOOK_SECRET`).
5. Submit a record and verify its dated laundry tab contains every current inventory item, staff name, sent quantity, received quantity, in-house stock, and timestamp.

The existing deployed Apps Script must be updated before laundry sync works. Booking actions remain available in the same handler.

Records are saved to MongoDB before the Google request. A missing connection or failed request appears as “Sync pending”; an admin can retry from Recent submissions. Stable submission IDs prevent duplicate rows when retrying. No live Sheets connection has been verified until the destination/script are configured.
