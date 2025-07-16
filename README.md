# Radiology Platform - Comprehensive DICOM Imaging Solution

A complete radiology imaging platform built on the open-source OHIF Viewers project, designed for healthcare organizations to provide tele-radiology services.

## 🚀 Features

### Core Functionality
- **DICOM Viewer**: Advanced DICOM image viewing with zoom, pan, annotations, and measurement tools
- **Study Management**: Complete workflow for study assignment, tracking, and reporting
- **Real-time Collaboration**: Socket.IO powered real-time notifications and communication
- **Multi-tenant Architecture**: Organization-based separation with role-based access control
- **Report Generation**: Template-based reporting with electronic signatures
- **STAT Order Support**: Priority handling for urgent studies with automated notifications

### Cross-Platform Compatibility
- **Responsive Design**: Optimized for desktop, tablets, iPads, and mobile phones
- **Progressive Web App (PWA)**: Installable on all platforms with offline capabilities
- **Dark/Light Theme**: Automatic theme detection with manual override
- **Touch-Friendly**: Optimized touch interactions for mobile devices
- **Cross-Browser**: Compatible with Chrome, Firefox, Safari, and Edge

### Healthcare Compliance
- **HIPAA Compliant**: Encrypted data transmission and storage
- **Audit Trail**: Complete activity logging for compliance
- **Data De-identification**: Tools for protecting patient privacy
- **Electronic Signatures**: Secure report signing with PKI
- **Two-Factor Authentication**: Enhanced security with 2FA support

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- Redis (v6 or higher)
- Docker & Docker Compose (optional)

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd radiology-platform
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
```

### 4. Database Setup
```bash
# Start PostgreSQL and Redis (with Docker)
docker-compose up -d postgres redis

# Or install locally:
# PostgreSQL: https://www.postgresql.org/download/
# Redis: https://redis.io/download
```

### 5. Environment Configuration

#### Backend (.env)
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=radiology_platform
DB_USER=postgres
DB_PASSWORD=password123

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=24h

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Application Configuration
PORT=3001
NODE_ENV=development
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_DICOM_WEB_ROOT=http://localhost:8042
NEXT_PUBLIC_APP_NAME=Radiology Platform
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 🚀 Running the Application

### Development Mode

#### Start Backend
```bash
cd backend
npm run dev
```

#### Start Frontend
```bash
cd frontend
npm run dev
```

### Production Mode

#### Build and Start Backend
```bash
cd backend
npm run build
npm start
```

#### Build and Start Frontend
```bash
cd frontend
npm run build
npm start
```

### Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# Or build individually
docker-compose up -d postgres redis
docker-compose up -d backend
docker-compose up -d frontend
```

## 📱 Cross-Platform Features

### Mobile Optimization
- **Touch Gestures**: Pinch-to-zoom, swipe navigation
- **Responsive Layout**: Adaptive UI for all screen sizes
- **Mobile-First Design**: Optimized for mobile performance
- **Offline Support**: PWA capabilities for offline access

### Desktop Features
- **Keyboard Shortcuts**: Efficient navigation and tools
- **Multi-Window Support**: Open multiple studies simultaneously
- **Drag & Drop**: File upload and organization
- **Printing Support**: High-quality report printing

### Tablet & iPad
- **Apple Pencil Support**: Annotation tools for iPad
- **Split Screen**: Multi-tasking capabilities
- **Gesture Navigation**: Intuitive touch controls
- **Landscape/Portrait**: Adaptive orientation support

## 🔒 Security Features

### Authentication & Authorization
- **JWT-based Authentication**: Secure token-based auth
- **Role-Based Access Control**: Admin, Radiologist, Manager roles
- **Two-Factor Authentication**: TOTP-based 2FA
- **Session Management**: Secure session handling

### Data Protection
- **End-to-End Encryption**: Data encrypted in transit and at rest
- **HIPAA Compliance**: Healthcare data protection standards
- **Audit Logging**: Complete activity tracking
- **Data Backup**: Automated backup and recovery

## 🏥 Healthcare Workflow

### Study Management
1. **DICOM Upload**: Secure upload from medical devices
2. **Study Assignment**: Automatic assignment to radiologists
3. **Priority Handling**: STAT orders with urgent notifications
4. **Progress Tracking**: Real-time status updates

### Reporting Workflow
1. **Template Selection**: Choose appropriate report template
2. **Image Annotation**: Add measurements and annotations
3. **Report Generation**: Create structured reports
4. **Electronic Signature**: Secure report signing
5. **Distribution**: Automated report delivery

## 📊 Test Data

The application includes a sample DICOM dataset from [dicomlibrary.com](https://www.dicomlibrary.com?study=1.3.6.1.4.1.44316.6.102.1.20250704114423696.61158672119535771932) for testing purposes.

### Import Test Data
```bash
cd backend
node scripts/importDicomData.js
```

This creates:
- Test organization
- Sample user (email: test@radiologyplatform.com, password: password123)
- Sample DICOM study
- Report templates
- SLA configurations

## 🔧 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Study Management
- `GET /api/studies` - List studies
- `POST /api/studies` - Upload DICOM study
- `GET /api/studies/:id` - Get study details
- `PUT /api/studies/:id/assign` - Assign study to radiologist

### Report Management
- `GET /api/reports` - List reports
- `POST /api/reports` - Create new report
- `PUT /api/reports/:id` - Update report
- `POST /api/reports/:id/sign` - Sign report

## 🌐 Browser Support

| Browser | Desktop | Mobile | Tablet |
|---------|---------|---------|---------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |

## 📦 Deployment Options

### Cloud Platforms
- **AWS**: EC2, RDS, ElastiCache
- **Google Cloud**: Compute Engine, Cloud SQL, Memorystore
- **Azure**: Virtual Machines, Database for PostgreSQL, Redis Cache
- **Heroku**: Easy deployment with add-ons

### On-Premises
- **Docker**: Containerized deployment
- **Kubernetes**: Orchestrated deployment
- **Traditional**: Direct installation on servers

## 🔍 Monitoring & Logging

### Application Monitoring
- **Health Checks**: Automated health monitoring
- **Performance Metrics**: Response times and throughput
- **Error Tracking**: Comprehensive error logging
- **User Analytics**: Usage patterns and behavior

### Security Monitoring
- **Audit Logs**: Complete activity tracking
- **Security Alerts**: Suspicious activity detection
- **Compliance Reporting**: HIPAA compliance reports
- **Access Monitoring**: User access patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Email: support@radiologyplatform.com
- Documentation: [docs.radiologyplatform.com](https://docs.radiologyplatform.com)
- Issues: [GitHub Issues](https://github.com/radiology-platform/issues)

## 🚧 Roadmap

### Upcoming Features
- **AI Integration**: Automated anomaly detection
- **Advanced Analytics**: Study performance metrics
- **Mobile App**: Native iOS/Android applications
- **HL7 Integration**: Healthcare data exchange
- **Voice Recognition**: Speech-to-text for reports

### Long-term Goals
- **Multi-language Support**: Internationalization
- **Cloud Storage**: DICOM cloud storage integration
- **Federated Learning**: Collaborative AI training
- **Blockchain**: Secure audit trails

---

**Built with ❤️ for healthcare professionals worldwide**
