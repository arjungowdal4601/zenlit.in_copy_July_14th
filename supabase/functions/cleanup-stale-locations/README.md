# Cleanup stale locations

This edge function clears `latitude` and `longitude` values from the `profiles`
table when they have not been updated in the last five minutes.

Deploy the function and schedule it to run every five minutes using Supabase
scheduled functions or any cron service.
