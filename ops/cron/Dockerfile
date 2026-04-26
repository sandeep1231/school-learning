# Tiny image used by Render Cron Job to invoke the daily-summary HTTP route.
# The job stays as an HTTP endpoint so it shares Sentry, logs, env, and
# rate-limit middleware with the rest of the app.
FROM alpine:3.20
RUN apk add --no-cache curl ca-certificates
COPY run.sh /run.sh
RUN chmod +x /run.sh
CMD ["/run.sh"]
