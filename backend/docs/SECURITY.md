# Security Guidelines

This document outlines security practices, tools, and guidelines for the Shiojiri Rainbow Seeker backend application.

## Table of Contents

- [Security Scanning Tools](#security-scanning-tools)
- [Running Security Scans](#running-security-scans)
- [Common Vulnerabilities](#common-vulnerabilities)
- [Security Best Practices](#security-best-practices)
- [OWASP Top 10 Compliance](#owasp-top-10-compliance)
- [Data Protection](#data-protection)
- [Authentication and Authorization](#authentication-and-authorization)
- [Reporting Security Issues](#reporting-security-issues)

## Security Scanning Tools

### Brakeman

[Brakeman](https://brakemanscanner.org/) is a static analysis security scanner for Ruby on Rails applications.

**What it detects:**
- SQL Injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Mass Assignment vulnerabilities
- Remote Code Execution
- Command Injection
- File Access issues
- Session Security problems
- Unsafe Redirects
- Dangerous Send calls

**Configuration:** `.brakeman.yml`

### bundler-audit

[bundler-audit](https://github.com/rubysec/bundler-audit) checks for vulnerable versions of gems in your Gemfile.

**What it detects:**
- Known CVEs in gem dependencies
- Insecure gem sources
- Gems with available security patches

## Running Security Scans

### Quick Start

```bash
# Run all security scans
bin/security_scan

# Or using rake
bundle exec rake security:scan
```

### Shell Script Commands

```bash
# Run all scans
bin/security_scan

# Run only Brakeman
bin/security_scan brakeman

# Run only bundler-audit
bin/security_scan audit

# Quick scan (minimal output)
bin/security_scan quick

# CI mode (fail on any vulnerability)
bin/security_scan ci
```

### Rake Task Commands

```bash
# Run all security scans
bundle exec rake security:scan

# Run only Brakeman
bundle exec rake security:brakeman

# Run only bundler-audit
bundle exec rake security:audit

# Update vulnerability database
bundle exec rake security:update

# Generate comprehensive report
bundle exec rake security:report

# CI mode (quick check)
bundle exec rake security:ci
```

### CI/CD Integration

For continuous integration, use:

```bash
# GitHub Actions / CI systems
bundle exec rake security:ci
```

This returns exit code 1 if any vulnerabilities are found.

## Common Vulnerabilities

### 1. SQL Injection

**Risk:** Attackers can execute arbitrary SQL queries.

**Prevention:**
```ruby
# BAD - vulnerable to SQL injection
User.where("name = '#{params[:name]}'")

# GOOD - use parameterized queries
User.where(name: params[:name])
User.where("name = ?", params[:name])
```

### 2. Cross-Site Scripting (XSS)

**Risk:** Attackers can inject malicious scripts into web pages.

**Prevention:**
```ruby
# BAD - outputs raw HTML
<%= raw user_input %>
<%= user_input.html_safe %>

# GOOD - Rails auto-escapes by default
<%= user_input %>

# If you need HTML, sanitize it
<%= sanitize(user_content, tags: %w[p br strong em]) %>
```

### 3. Cross-Site Request Forgery (CSRF)

**Risk:** Attackers can perform actions on behalf of authenticated users.

**Prevention:**
- Rails includes CSRF protection by default
- For API endpoints using JWT, CSRF is typically not needed
- Never disable CSRF protection without understanding the implications

### 4. Mass Assignment

**Risk:** Attackers can modify attributes they shouldn't have access to.

**Prevention:**
```ruby
# Use strong parameters
def user_params
  params.require(:user).permit(:name, :email)
end

# BAD
User.create(params[:user])

# GOOD
User.create(user_params)
```

### 5. Insecure Direct Object References (IDOR)

**Risk:** Users can access resources belonging to other users.

**Prevention:**
```ruby
# BAD - allows access to any photo
Photo.find(params[:id])

# GOOD - scope to current user
current_user.photos.find(params[:id])

# Or use Pundit for authorization
authorize @photo
```

### 6. Command Injection

**Risk:** Attackers can execute system commands.

**Prevention:**
```ruby
# BAD - vulnerable to command injection
system("ls #{params[:dir]}")

# GOOD - use arrays to prevent injection
system("ls", params[:dir])

# Or use Shellwords
system("ls #{Shellwords.escape(params[:dir])}")
```

### 7. Sensitive Data Exposure

**Risk:** Sensitive data is exposed in logs, responses, or storage.

**Prevention:**
- Filter sensitive params in logs (`config/initializers/filter_parameter_logging.rb`)
- Never log passwords, tokens, or API keys
- Use encryption for sensitive data at rest
- Always use HTTPS for data in transit

## Security Best Practices

### 1. Input Validation

Always validate user input:

```ruby
# In models
validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
validates :age, numericality: { only_integer: true, greater_than: 0 }

# Custom validators for specific patterns
validates_with CoordinatesValidator
```

### 2. Output Encoding

- Rails auto-escapes HTML by default - don't disable it
- Use `content_tag` for dynamic HTML generation
- Sanitize user-generated HTML content

### 3. Authentication

- Use Devise with secure defaults
- Implement proper password policies
- Use JWT with appropriate expiration times
- Implement account lockout after failed attempts

### 4. Authorization

- Use Pundit for policy-based authorization
- Always authorize actions, not just authenticate
- Implement principle of least privilege

### 5. Session Management

- Use secure session settings
- Implement session timeouts
- Regenerate session ID after login

### 6. Error Handling

- Never expose stack traces in production
- Use generic error messages for users
- Log detailed errors for developers

### 7. Dependency Management

- Regularly run `bundle exec bundler-audit`
- Keep gems up to date
- Review changelogs for security fixes

## OWASP Top 10 Compliance

This application addresses the OWASP Top 10 (2021):

| Risk | Mitigation |
|------|------------|
| A01:2021 - Broken Access Control | Pundit policies, scoped queries |
| A02:2021 - Cryptographic Failures | bcrypt for passwords, HTTPS, encrypted storage |
| A03:2021 - Injection | Strong parameters, parameterized queries |
| A04:2021 - Insecure Design | Security review, threat modeling |
| A05:2021 - Security Misconfiguration | Secure defaults, environment-specific configs |
| A06:2021 - Vulnerable Components | bundler-audit, regular updates |
| A07:2021 - Auth Failures | Devise, JWT with expiration, rate limiting |
| A08:2021 - Data Integrity Failures | Input validation, signed cookies |
| A09:2021 - Security Logging | Structured logging, audit trails |
| A10:2021 - Server-Side Request Forgery | URL validation, allowlists |

## Data Protection

### Encryption at Rest

- Passwords are hashed using bcrypt
- Sensitive configuration uses encrypted credentials
- Database encryption for sensitive fields (if required)

### Encryption in Transit

- All production traffic uses HTTPS/TLS
- API requests require secure connections
- JWT tokens transmitted securely

### Data Retention

- User data deletion available (GDPR compliance)
- Soft deletes preserve audit trail
- Automated cleanup of expired sessions/tokens

## Authentication and Authorization

### JWT Configuration

- Short-lived access tokens (configurable expiration)
- Secure token storage recommendations for clients
- Token revocation support via JWT denylist

### Password Requirements

- Minimum 8 characters (configurable)
- Complexity requirements via Devise
- Password history tracking (optional)

### Rate Limiting

- Login attempt limits
- API rate limiting per user/IP
- Configurable thresholds

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Contact the security team directly
3. Provide detailed reproduction steps
4. Allow time for a fix before public disclosure

### Security Contact

- Email: [security contact email]
- Use PGP encryption if available

## Security Scan Reports

Reports are generated in `tmp/security_reports/`:

- `brakeman_report.html` - Visual Brakeman report
- `brakeman_report.json` - Machine-readable Brakeman output
- `bundler_audit_report.txt` - Dependency vulnerability report
- `security_summary.md` - Combined summary report

## Continuous Security

Security scanning is integrated into the CI/CD pipeline:

1. **Pre-commit**: Developers can run local scans
2. **Pull Request**: Automated scans block merging if issues found
3. **Nightly**: Scheduled scans for new vulnerabilities
4. **Release**: Full security audit before deployment

## Resources

- [Brakeman Documentation](https://brakemanscanner.org/docs/)
- [OWASP Ruby Security Guide](https://cheatsheetseries.owasp.org/cheatsheets/Ruby_on_Rails_Cheat_Sheet.html)
- [Rails Security Guide](https://guides.rubyonrails.org/security.html)
- [Ruby Advisory Database](https://rubysec.com/)
- [CVE Database](https://cve.mitre.org/)
