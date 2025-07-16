# Radiology Platform Backend

A comprehensive backend for a radiology imaging platform that provides tele-radiology services with full DICOM support, multi-tenancy, and advanced workflow management.

## Features

### Core Features (Must Have)
- ✅ **Multi-tenant Architecture**: Complete isolation for healthcare organizations
- ✅ **DICOM Data Management**: Full DICOM study, series, and instance management
- ✅ **User Management**: Role-based access control (admin, radiologist, manager, technician, viewer)
- ✅ **Study Assignment**: Intelligent assignment of studies to radiologists
- ✅ **Report Generation**: Comprehensive reporting with electronic signatures
- ✅ **SLA Management**: Service level agreements with automated alerts
- ✅ **Rating System**: 1-5 star rating system for radiologists
- ✅ **Billing & Invoicing**: Complete billing management system
- ✅ **Audit Trail**: Comprehensive audit logging for compliance
- ✅ **Notifications**: Real-time notifications for STAT orders and SLA breaches
- ✅ **Security**: HIPAA-compliant with end-to-end encryption
- ✅ **Multi-language Support**: i18n support for global deployment

### Authentication & Security
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Two-factor authentication support
- Password reset and email verification
- Session management with Redis
- API rate limiting
- Comprehensive audit logging

### Database Schema
- **Organizations**: Multi-tenant organization management
- **Users**: User management with roles and permissions
- **Studies**: DICOM study metadata and workflow
- **Series**: DICOM series data
- **Instances**: Individual DICOM instances
- **Reports**: Radiology reports with versioning
- **SLAs**: Service level agreements
- **Ratings**: Radiologist performance ratings
- **Billing**: Invoicing and payment tracking
- **Notifications**: Real-time notification system
- **Audit Logs**: Complete audit trail

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Knex.js ORM
- **Cache**: Redis
- **Authentication**: JWT with Passport.js
- **File Storage**: AWS S3 or local storage
- **Real-time**: Socket.IO
- **Queue**: Bull (Redis-based)
- **Logging**: Winston
- **Testing**: Jest
- **Documentation**: JSDoc

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- npm or yarn

### Setup

1. **Clone and Install**
```bash
cd backend
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database Setup**
```bash
# Create database
createdb radiology_dev

# Run migrations
npm run migrate

# Optional: Seed data
npm run seed
```

4. **Start Services**
```bash
# Development
npm run dev

# Production
npm start
```

## API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "organization_code": "ORG001"
}
```

#### POST /api/auth/login
User login
```json
{
  "email": "user@example.com",
  "password": "password123",
  "two_factor_code": "123456"
}
```

#### GET /api/auth/me
Get current user profile
```bash
Authorization: Bearer <token>
```

### Study Management

#### GET /api/studies
List studies with filtering
```bash
GET /api/studies?status=unread&modality=CT&priority=urgent
```

#### POST /api/studies
Create new study
```json
{
  "study_instance_uid": "1.2.3.4.5",
  "patient_name": "John Doe",
  "study_description": "CT Chest",
  "modality": "CT",
  "priority": "normal"
}
```

#### PUT /api/studies/:id/assign
Assign study to radiologist
```json
{
  "radiologist_id": "uuid-here"
}
```

### Report Management

#### GET /api/reports
List reports
```bash
GET /api/reports?status=finalized&radiologist_id=uuid
```

#### POST /api/reports
Create new report
```json
{
  "study_id": "uuid-here",
  "findings": "Normal chest CT",
  "impression": "No acute abnormalities",
  "recommendations": "Routine follow-up"
}
```

#### PUT /api/reports/:id/finalize
Finalize report
```json
{
  "electronic_signature": "signature-hash"
}
```

### Organization Management

#### GET /api/organizations
List organizations (admin only)

#### POST /api/organizations
Create new organization
```json
{
  "name": "City Hospital",
  "code": "CITY001",
  "type": "healthcare",
  "address": {...},
  "contact_email": "admin@cityhospital.com"
}
```

## Database Schema

### Key Tables

#### Organizations
- Multi-tenant organization management
- Branding and customization settings
- SLA defaults and billing configuration

#### Users
- User authentication and profiles
- Role-based permissions
- Rating and performance tracking

#### Studies
- DICOM study metadata
- Workflow status tracking
- Assignment and priority management

#### Reports
- Radiology reports with versioning
- Electronic signatures
- Multi-language support

#### SLAs
- Service level agreements
- Automated breach detection
- Escalation rules

## Security Features

### HIPAA Compliance
- End-to-end encryption
- Access control and audit logging
- Data anonymization tools
- Secure file storage

### Authentication
- JWT tokens with refresh mechanism
- Two-factor authentication
- Session management
- Rate limiting

### Authorization
- Role-based access control
- Resource-level permissions
- Organization-level isolation

## Deployment

### Docker Deployment

1. **Build Images**
```bash
docker build -t radiology-backend .
```

2. **Run with Docker Compose**
```bash
docker-compose up -d
```

### Production Considerations

- Set up SSL/TLS certificates
- Configure reverse proxy (Nginx)
- Set up monitoring and logging
- Configure backup strategies
- Set up CI/CD pipeline

## API Rate Limits

- Authentication endpoints: 5 requests per 15 minutes
- General API: 100 requests per 15 minutes
- File upload: 10 requests per minute

## Error Handling

All API responses follow a consistent error format:
```json
{
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

## Logging

The application uses Winston for logging with the following levels:
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug-level messages

Logs are stored in:
- `logs/app-YYYY-MM-DD.log`: General application logs
- `logs/error-YYYY-MM-DD.log`: Error logs
- `logs/audit-YYYY-MM-DD.log`: Audit logs

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## Performance Optimization

- Redis caching for frequently accessed data
- Database query optimization with indexes
- File compression and CDN integration
- Connection pooling for database
- Queue-based processing for heavy operations

## Monitoring

- Health check endpoint: `/health`
- Metrics endpoint: `/metrics`
- Application monitoring with Winston
- Error tracking with Sentry (optional)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.