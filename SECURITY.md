# Security Policy

## Reporting a Vulnerability

We take security seriously at CAI Intake. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email us at:

📧 **security@cai-intake.io**

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

| Timeline | Action |
|----------|--------|
| **24 hours** | Acknowledgment of receipt |
| **72 hours** | Initial assessment |
| **7 days** | Detailed response with remediation plan |
| **30-90 days** | Fix deployed (depending on severity) |

### Responsible Disclosure

We ask that you:
- Give us reasonable time to respond before public disclosure
- Do not access, modify, or delete data belonging to others
- Act in good faith to avoid privacy violations and service disruption

### Recognition

We appreciate security researchers who help us improve. Contributors who report valid vulnerabilities may be:
- Acknowledged in our security hall of fame
- Offered rewards for critical findings (at our discretion)

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x.x | ✅ Active support |
| 1.x.x | ⚠️ Security fixes only |
| < 1.0 | ❌ No longer supported |

---

## Security Measures

### Data Protection

- **Encryption in Transit**: TLS 1.3 for all communications
- **Encryption at Rest**: AES-256 for stored data
- **Row-Level Security**: Database-level access controls
- **API Authentication**: Bearer tokens and API keys

### Application Security

- **Input Validation**: Zod schemas for all inputs
- **SQL Injection**: Parameterized queries via Prisma ORM
- **XSS Prevention**: React's built-in escaping
- **CSRF Protection**: SameSite cookies
- **Rate Limiting**: Per-user and per-IP limits

### Infrastructure

- **Hosting**: Vercel with automatic security updates
- **Database**: Supabase with managed security
- **Secrets**: Environment variables, never in code
- **Audit Logs**: Complete action logging

### AI Security

- **Data Isolation**: Organization data never mixed
- **No Public Training**: Customer data not used for general models
- **API Key Security**: Keys are hashed, never logged

---

## Security Best Practices for Users

### API Keys

- Rotate API keys regularly
- Use environment variables, never hardcode
- Restrict key scopes to minimum required
- Revoke unused or compromised keys immediately

### Account Security

- Use strong, unique passwords
- Enable 2FA when available (coming soon)
- Review team member access regularly
- Audit login activity

### Data Handling

- Only upload data you're authorized to process
- Review parsed data before production use
- Export and backup important cutlists

---

## Compliance

### Current Status

| Standard | Status |
|----------|--------|
| **GDPR** | ✅ Compliant |
| **SOC 2 Type II** | 🔄 In progress |
| **ISO 27001** | 📋 Planned |

### Data Residency

- Primary region: US (Vercel/Supabase)
- EU region: Available for Enterprise customers

---

## Contact

For security matters: security@cai-intake.io

For general support: support@cai-intake.io

---

<p align="center">
  <em>Last updated: January 2025</em>
</p>

