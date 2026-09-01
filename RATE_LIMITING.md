# Free Quota Protection: Rate Limiting & Database Cleanup

**Purpose:** Protect your Gemini Pro free quota and Neon free database from exhaustion due to bot attacks.

---

## System Overview

### The Problem
You have limited free quotas:
- **Gemini Pro (Student):** ~150 requests/day (or similar limit)
- **Neon Free Tier:** ~3GB storage

Bots or accidental spam can exhaust these in hours, making your portfolio unavailable.

### The Solution
Three-layer protection:

1. **Per-User Daily Limit:** 15 requests/day per session (IP + cookie)
2. **Global Daily Cap:** 100 requests/day total across all users
3. **Database Cleanup:** Auto-delete logs older than 7 days

### Design Philosophy
- **Real users:** Rarely hit limits (15 requests = ~1-2 hours of testing per day)
- **Bots:** Blocked immediately at request #16 per day
- **Database:** Auto-cleans to prevent storage exhaustion

---

## Rate Limiting

### Limits

```
Per User (daily):
├─ 15 requests/day per session/IP
└─ Quota resets at midnight UTC

Global (daily):
├─ 100 requests/day total
└─ Quota resets at midnight UTC
```

### How It Works

**Request arrives:**
1. Check global cap (100/day) → if exceeded, deny with 429
2. Check per-user limit (15/day) → if exceeded, deny with 429
3. Allow request, increment both counters
4. Return headers with remaining quota

**Redis Keys:**
```
rl_daily:{sessionId or IP}    → per-user counter (expires 24h)
rl_global_daily               → global counter (expires 24h)
```

### Response Headers

```
X-RateLimit-Limit: 15
X-RateLimit-Remaining: 12
X-RateLimit-Reset: 1693641240
X-RateLimit-Global-Remaining: 87
```

### Rate Limit Error (429)

```json
{
  "error": "Rate limited",
  "message": "You've reached your daily limit of 15 requests. Please try again tomorrow.",
  "resetIn": 43200,
  "remaining": 0
}
```

**Dashboard Shows:**
- Red notification banner
- Message: "Daily quota reached"
- Reset time: "Resets at 12:00 AM UTC"
- Auto-dismisses after 5 seconds

---

## Database Cleanup

### Automatic Cleanup

Runs on app startup, keeps only last **7 days** of audit logs.

```typescript
// Deletes logs older than 7 days
await db.auditLog.deleteMany({
  where: { createdAt: { lt: sevenDaysAgo } }
});
```

**Cron Alternative (optional):**
```bash
0 2 * * * curl -X POST http://localhost:8000/api/admin/cleanup
```

### Cleanup Details

- **What:** Audit logs (PROMPT_INJECTION events, tool execution logs)
- **When:** On app startup + optionally daily at 2 AM
- **Keep:** Last 7 days of logs only
- **Result:** Prevents Neon storage exhaustion

**Manual Cleanup (admin):**
```bash
curl -X POST http://localhost:8000/api/admin/cleanup-logs \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Response:
# { "deleted": 1234, "message": "Cleaned up 1234 old logs" }
```

---

## Identifier Tracking

How we identify users:

```
Priority:
1. sessionId cookie (set on first visit, 30-day TTL)
2. IP address (fallback, via X-Forwarded-For or socket)
```

**Session Cookie Setup:**
```javascript
// Auto-generated on app load
sessionId=session_${Date.now()}_${randomId}
expires=30 days
path=/
```

**Per-user quota:**
- Same person across multiple tabs: **same quota bucket** ✅
- Different IPs (VPN, mobile): **different quota buckets** (can each use 15)
- Same IP, different browsers: **different quota buckets** if no session

---

## Example Scenarios

### Legitimate User
```
Day 1:
- Makes 5 test prompts → ✅ Allowed (10 remaining)
- Takes a break
- Makes 3 more prompts → ✅ Allowed (7 remaining)
- Total: 8/15 used

Day 2:
- Quota resets at midnight → 15 requests available again
```

### Bot Attack (Rapid-Fire)
```
Bot sends 25 requests in 1 second:
- Request 1-15: ✅ Allowed
- Request 16-25: ❌ 429 Rate Limited

Result: Bot needs to change IP/session to try again
Cost to you: Only 15 Gemini quota consumed
```

### Slow Attack (Drip)
```
Attacker makes 10 requests per day for 3 days:
- Day 1: 10 requests → ✅ Allowed
- Day 2: 10 requests → ✅ Allowed  
- Day 3: 5 requests → ✅ Allowed, then 10 more → ❌ 429

Cost to you: ~35 Gemini quota consumed before hitting limit
```

### Global Cap Hit
```
Total traffic reaches 100 requests at 2:45 PM UTC:
- Request 100 (user A): ✅ Allowed
- Request 101 (user B): ❌ "Daily quota exhausted"
- Request 102+ (any user): ❌ Same error

At midnight UTC: Cap resets, users can make requests again
```

---

## Tuning

### Change Per-User Limit

Edit `apps/agent/src/api/security.routes.ts`:

```typescript
const rateLimiter = rateLimitMiddleware({ dailyLimit: 20 }); // Was 15
```

**Common values:**
- `10` — Very strict, ~2 users per day max
- `15` — Default, safe for student use (6-10 concurrent users)
- `20` — Generous, for low-traffic portfolio
- `50` — Would exhaust quota quick, not recommended on free tier

### Change Global Cap

Edit `apps/agent/src/services/rate-limiter.service.ts`:

```typescript
async checkGlobalCap(globalLimit: number): Promise<RateLimitResult> {
  // Change 100 to desired limit:
  const allowed = count <= 100; // ← here
```

**Default 100** assumes:
- ~6-7 users × 15 requests each = ~90-105 requests/day
- Leaves margin for cleanup

### Change Cleanup Window

Edit `apps/agent/src/services/db-cleanup.service.ts`:

```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
// Change 7 to desired days
```

---

## Monitoring

### Check Rate Limit Status

```bash
# Get global count
curl http://localhost:8000/api/health | grep rateLimit

# Expected: 
# { "rateLimit": { "global": 45, "limit": 100 } }
```

### Check Database Size

```bash
# In Neon dashboard or psql:
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Healthy state:** `audit_log` should be ~50-200 MB (7 days of logs)

### Check Redis Keys

```bash
redis-cli KEYS "rl_*"
# Shows: rl_daily:{user1}, rl_daily:{user2}, rl_global_daily

# Get current global count:
redis-cli GET rl_global_daily
# Shows: 45
```

---

## Alerts & Maintenance

### Daily Checklist

```
☑️ Check Gemini quota usage (Google Cloud console)
   Should be ~70-100 requests/day max
   
☑️ Check Neon database size (Neon dashboard)
   Should be stable or slightly growing (older logs deleted)
   
☑️ Check application logs for errors
   Watch for: Redis failures, cleanup errors
   
☑️ Check rate limit rejections
   Should be <5 per day
```

### What To Do If

**"Database is full (Neon limit reached)"**
- Run manual cleanup:
  ```bash
  curl -X POST http://localhost:8000/api/admin/cleanup-logs \
    -H "Authorization: Bearer ADMIN_TOKEN"
  ```
- Reduce cleanup window from 7 days to 3 days (see Tuning)
- Increase global cap is NOT the solution (you're already at quota)

**"Gemini API returns quota exceeded"**
- Lower per-user limit: `15 → 10`
- Lower global cap: `100 → 50`
- Restart service
- Wait until next day (quotas reset)

**"Many rate limit rejections (>20/day)"**
- Check logs for bot IPs
- May be legitimate spike, increase limits if intentional
- Monitor for patterns (same IP repeatedly hitting limit)

**"Redis connection failing"**
- Rate limiter fails-open (allows all requests)
- Restart Redis: `redis-cli shutdown`
- Check REDIS_URL env var is set correctly

---

## Deployment

### Environment Variables

```bash
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@host/db
NODE_ENV=production
```

### Database Setup

```bash
# Neon free tier: Create table automatically via Prisma
pnpm prisma migrate deploy

# Verify table exists:
psql $DATABASE_URL -c "\dt audit_log"
```

### Testing Rate Limits

```bash
# Test 1: Make 15 requests (should all succeed)
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/security/scan \
    -H "Content-Type: application/json" \
    -d '{"prompt":"test"}' \
    -b cookies.txt -c cookies.txt
done

# Test 2: Make 1 more request (should get 429)
curl -X POST http://localhost:3000/api/security/scan \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}' \
  -b cookies.txt \
  -i

# Should see: HTTP/1.1 429 Too Many Requests
# { "error": "Rate limited", "message": "... daily limit of 15 ..." }
```

### Testing Cleanup

```bash
# Manually trigger cleanup on startup, or:
curl -X POST http://localhost:8000/api/admin/cleanup-logs \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check logs deleted:
# [db-cleanup] Deleted 1234 audit logs older than 7 days
```

---

## Troubleshooting

### Rate Limiter Always Allows Requests

**Problem:** Every request succeeds, even after 20+

**Check:**
```bash
redis-cli GET rl_global_daily
# If empty: Redis is not connecting
```

**Solution:**
```bash
# Verify Redis is running:
redis-cli PING
# Response: PONG

# Check connection string:
echo $REDIS_URL
# Should output: redis://localhost:6379
```

### Cleanup Never Runs

**Problem:** Database keeps growing, cleanup doesn't run

**Check:**
```bash
# Look for startup logs:
grep "db-cleanup" logs.txt
# Should see: "[db-cleanup] Deleted X audit logs..."
```

**Solution:**
```bash
# Restart app (cleanup runs on startup):
npm run start

# Or manually trigger:
curl -X POST http://localhost:8000/api/admin/cleanup-logs \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Quotas Exceeded Despite Limits

**Problem:** Gemini quota exhausted or Neon full, limits didn't help

**Likely Cause:** 
- Limits weren't deployed yet, old code still running
- Global cap set too high (100 might be too many for your quota)
- Cleanup isn't running (database fills up)

**Fix:**
1. Verify deployed code has rate limiting
2. Lower global cap to 50 (more conservative)
3. Check cleanup logs
4. Restart both app and Redis

---

## Reference

### Files

- `apps/agent/src/services/rate-limiter.service.ts` — Rate limiting logic
- `apps/agent/src/services/db-cleanup.service.ts` — Database cleanup
- `apps/agent/src/api/middleware/rate-limit.middleware.ts` — Express middleware
- `apps/agent/src/api/security.routes.ts` — API endpoint with rate limiting
- `apps/dashboard/components/PromptPlaygroundView.tsx` — UI notification

### Configuration

| Setting | File | Default | Range |
|---------|------|---------|-------|
| Daily per-user limit | `security.routes.ts` | 15 | 5-50 |
| Global daily cap | `rate-limiter.service.ts` | 100 | 50-200 |
| Log retention | `db-cleanup.service.ts` | 7 days | 1-14 days |

### Redis Keys Used

| Key | Purpose | TTL |
|-----|---------|-----|
| `rl_daily:{id}` | Per-user daily counter | 24h |
| `rl_global_daily` | Global daily counter | 24h |

---

## FAQ

**Q: Will real users see the "daily limit reached" message?**
A: Only if they make 15+ requests in one day. Typical exploration = 3-5 requests.

**Q: What if someone keeps creating new sessions to bypass the limit?**
A: Their IP is also tracked. If they hop sessions, same IP still shares global cap (100 total).

**Q: Can I whitelist my own IP for unlimited requests?**
A: Yes. Skip middleware for specific IPs:
```typescript
if (req.socket.remoteAddress === "203.0.113.1") return next();
```

**Q: Will bots find a way around this?**
A: They'll switch IPs or wait for quota resets. But without sophisticated infrastructure, they can't do much with 15 reqs/day. Combined with patterns + embeddings security, you're safe.

**Q: How do I handle a legitimate traffic spike?**
A: Increase limits temporarily:
```typescript
const rateLimiter = rateLimitMiddleware({ dailyLimit: 30 }); // 15 → 30
```

**Q: What happens if Gemini quota is exhausted?**
A: API returns error → LLM judge fails → request marked as suspicious (conservative). Portfolio still works, just slower/less features.

---

**Last Updated:** 2026-09-02  
**Version:** 2.0 (Free Quota Protection)
