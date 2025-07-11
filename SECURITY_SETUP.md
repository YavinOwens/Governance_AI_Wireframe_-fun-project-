# 🔐 Security Setup Guide

This guide explains how to properly configure the Governance Workshop Platform with secure environment variables and remove any exposed credentials.

## 🚨 Critical Security Updates Applied

The following security vulnerabilities have been identified and fixed:

### ✅ Fixed Issues:
1. **Exposed OpenAI API Key** - Removed hardcoded API key from `src/lib/documents/processor.ts`
2. **Hardcoded Database Credentials** - Updated API routes to use environment variables
3. **Missing Environment Configuration** - Created comprehensive `.env` template

## 📋 Environment Setup

### 1. Copy Environment Template
```bash
cp .env .env.local  # Create your local environment file
```

### 2. Required Environment Variables

#### 🗄️ Database Configuration (Required)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=future_thought_db
DB_USER=admin
DB_PASSWORD=your_secure_database_password_here
```

#### 🤖 AI Services (Required for full functionality)
```env
OPENAI_API_KEY=your_openai_api_key_here
```

#### 🔐 Security (Required)
```env
JWT_SECRET=your_very_secure_jwt_secret_minimum_32_characters_long
SESSION_SECRET=your_session_secret_minimum_32_characters_long
```

#### ⚙️ Application (Required)
```env
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### 3. Optional Integrations
```env
# Anthropic AI (optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# AWS S3 (optional, for file storage)
AWS_S3_BUCKET=your_s3_bucket_name
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key

# SharePoint (optional)
SHAREPOINT_SITE_URL=your_sharepoint_site_url
SHAREPOINT_CLIENT_ID=your_sharepoint_client_id
SHAREPOINT_CLIENT_SECRET=your_sharepoint_client_secret
```

## 🛡️ Security Best Practices

### 1. Generate Secure Secrets
```bash
# Generate JWT Secret (minimum 32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Session Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Database Security
- Use a strong database password (minimum 12 characters)
- Consider using connection pooling limits
- Enable SSL for production databases
- Regularly rotate database credentials

### 3. API Key Management
- Never commit API keys to version control
- Use different API keys for development/production
- Implement rate limiting for API endpoints
- Monitor API key usage

### 4. Production Environment
```env
NODE_ENV=production
DB_PASSWORD=production_secure_password
JWT_SECRET=production_jwt_secret_64_characters_minimum
```

## 🔍 Security Verification Checklist

### ✅ Pre-Deployment Checklist
- [ ] `.env` file is not committed to git
- [ ] All API keys are environment variables
- [ ] Database credentials are secured
- [ ] JWT secrets are strong and unique
- [ ] No hardcoded credentials in code
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] SSL is configured for production

### 🔎 Code Security Scan
Run these commands to verify no credentials are exposed:

```bash
# Check for hardcoded API keys
grep -r "sk-" src/ || echo "✅ No OpenAI keys found"
grep -r "password.*=" src/ | grep -v process.env || echo "✅ No hardcoded passwords"
grep -r "secret.*=" src/ | grep -v process.env || echo "✅ No hardcoded secrets"

# Check for environment variable usage
grep -r "process.env" src/ | wc -l
```

## 🚀 Deployment Notes

### Environment-Specific Configurations

#### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_SQL=true
```

#### Production
```env
NODE_ENV=production
LOG_LEVEL=info
DEBUG_SQL=false
RATE_LIMIT_MAX_REQUESTS=100
```

### Docker Deployment
If using Docker, ensure environment variables are passed securely:

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - DB_PASSWORD_FILE=/run/secrets/db_password
    secrets:
      - db_password
```

## 🆘 Emergency Procedures

### If Credentials Are Compromised:
1. Immediately rotate all API keys
2. Change database passwords
3. Generate new JWT secrets
4. Update production environment
5. Review access logs
6. Notify team members

### Incident Response:
1. Identify the scope of exposure
2. Revoke compromised credentials
3. Deploy updated configuration
4. Monitor for unauthorized access
5. Document the incident

## 📞 Support

For security questions or incident reporting:
- Review this security guide
- Check environment variable configuration
- Verify `.env` file setup
- Test database connectivity

## 🔄 Regular Maintenance

### Monthly Tasks:
- [ ] Review environment variables
- [ ] Check for expired API keys
- [ ] Audit database access
- [ ] Update security dependencies
- [ ] Rotate JWT secrets (quarterly)

### Security Updates:
- Keep dependencies updated
- Monitor security advisories
- Regular penetration testing
- Code security reviews 