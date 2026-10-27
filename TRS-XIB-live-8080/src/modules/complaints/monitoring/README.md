# Complaint monitoring

Owns the `analysis-monitor`, `analysis-warnings`, and `analysis-warning-detail` routes, warning-list sorting, the warning detail page, and the explicit transition from a warning to a related ticket.

The warning-to-ticket transition uses the repository module context contract instead of mutating ticket-page state or DOM directly. Intelligent inspection batches and supervision-letter workflows remain in `app.js` until their shared subprocess dependencies are extracted in a separate PR.
