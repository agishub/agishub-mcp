# MCP Registry Publication — Manual DNS Setup

**Status:** ⏸ Blocked on DNS update (pending user action)

## Problem

`mcp-publisher login dns` fails with:
```
Error: signature verification failed (tried published key ed25519:Yxv3Jp0+)
```

**Reason:** DNS has an old key registered. Our new private key doesn't match the published public key in DNS.

## Solution: Update DNS TXT Record

You need to update the TXT record at your DNS provider (where agishub.com is registered).

### Step 1: Get the New Public Key

```bash
# The new public key (base64-encoded):
e7y81bMDxi4NnxNYyKoaXKsxrFWpSgLXO/OIWRlUjh8=
```

### Step 2: Update DNS TXT Record

Log in to your DNS provider (Cloudflare, Route53, Namecheap, etc.) and update:

**Record Name:** `_mcp-registry.agishub.com` (or just `_mcp-registry` if your provider auto-appends the domain)

**Record Type:** TXT

**Record Value:**
```
v=MCPv1; k=ed25519; p=e7y81bMDxi4NnxNYyKoaXKsxrFWpSgLXO/OIWRlUjh8=
```

### Step 3: Wait for DNS Propagation

DNS changes typically propagate in 5-30 minutes. You can check with:
```bash
dig @8.8.8.8 TXT _mcp-registry.agishub.com
```

### Step 4: Publish to Registry

Once DNS is updated, run:

```bash
cd /Users/miguel/Developer/Agishub/agishub-mcp
npx mcp-publisher login dns --domain agishub.com --private-key $(cat .mcpregistry_agishub_key)
npx mcp-publisher publish
```

## Next Steps

- [ ] Update DNS TXT record (manual step — requires DNS provider access)
- [ ] Verify DNS propagation (5-30 min)
- [ ] Run mcp-publisher login + publish
- [ ] Verify on registry.modelcontextprotocol.io

## Files Reference

- **Private key:** `.mcpregistry_agishub_key` (keep secret, never commit)
- **Server config:** `server.json` (ready to publish once auth succeeds)
- **Public key to register:** `e7y81bMDxi4NnxNYyKoaXKsxrFWpSgLXO/OIWRlUjh8=`

---

**Status after DNS update:** Unblock and run publish steps above.
