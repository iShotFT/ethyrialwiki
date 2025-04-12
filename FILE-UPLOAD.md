# File Upload System Documentation

## Overview

The file upload system uses AWS S3 for storage and implements a secure, presigned URL-based upload flow. Files are organized into different buckets based on their type and access requirements.

## Core Components

### Storage Implementation (`S3Storage.ts`)

- Handles all S3 interactions using AWS SDK v3
- Implements presigned URL generation for secure uploads
- Manages file storage, retrieval, and deletion
- Supports both path-style and virtual host-style URLs
- Handles temporary file operations for server-side processing

### Attachment Routes (`attachments.ts`)

- RESTful endpoints for file operations
- Implements rate limiting and authentication
- Handles file uploads, deletions, and URL-based imports
- Manages attachment metadata in the database

### Attachment Helper (`AttachmentHelper.ts`)

- Manages file organization and naming conventions
- Defines upload presets and their constraints
- Handles ACL and expiration settings
- Validates and sanitizes file paths

## Upload Flow

1. **Client Request**

   - Client sends file metadata (name, size, type) to `/api/attachments.create`
   - Request includes `preset` (avatar, document, import, etc.)

2. **Server Processing**

   - Validates user permissions based on preset
   - Checks file size against preset limits
   - Generates unique ID and S3 key
   - Creates attachment record in database
   - Generates presigned POST URL for S3

3. **Client Upload**

   - Client receives presigned URL and form fields
   - Directly uploads file to S3 using presigned URL
   - S3 validates upload against conditions (size, type)

4. **Access Control**
   - Files are organized by user ID and type
   - Private files require signed URLs for access
   - Public files (avatars) are directly accessible

## Security Analysis

### Strengths

1. **Authentication Required**

   - All upload endpoints require authentication
   - User permissions are checked based on preset type
   - Rate limiting prevents abuse (10/min for uploads)

2. **S3 Security**

   - Uses presigned URLs with expiration
   - Enforces content type and size limits
   - Files are stored with appropriate ACLs
   - Private files require signed URLs for access

3. **Path Sanitization**
   - File paths are sanitized to prevent directory traversal
   - Maximum filename length enforced
   - User-specific paths prevent cross-user access

### Potential Vulnerabilities

1. **Content Type Bypass**

   - The system checks content type but relies on client-provided type
   - Malicious user could potentially upload executable content with image type
   - Mitigation: Consider server-side content type verification

2. **Presigned URL Reuse**

   - Presigned URLs are valid for 1 hour
   - If URL is intercepted, it could be used by unauthorized parties
   - Mitigation: Consider shorter expiration times for sensitive uploads

3. **Storage Quota**

   - No per-user storage quota enforcement
   - Malicious user could fill up S3 bucket
   - Mitigation: Implement storage quotas and monitoring

4. **File Name Injection**
   - While paths are sanitized, filenames could contain malicious characters
   - Could cause issues with some S3 clients or viewers
   - Mitigation: Implement stricter filename validation

## Best Practices

1. **File Organization**

   - Use appropriate presets for different file types
   - Keep private files in `uploads` bucket
   - Use `public` bucket only for necessary files

2. **Access Control**

   - Always use the most restrictive ACL possible
   - Implement signed URLs for private content
   - Regularly audit file access patterns

3. **Monitoring**

   - Monitor upload patterns for abuse
   - Track storage usage per user/team
   - Set up alerts for unusual activity

4. **Maintenance**
   - Regularly clean up expired attachments
   - Monitor S3 bucket policies
   - Keep AWS SDK and dependencies updated

## Configuration

Required environment variables:

```env
FILE_STORAGE=s3
AWS_S3_UPLOAD_BUCKET_URL=https://s3.eu-central-1.amazonaws.com
AWS_S3_UPLOAD_BUCKET_NAME=your-bucket-name
AWS_REGION=eu-central-1
AWS_S3_FORCE_PATH_STYLE=true
AWS_S3_ACL=private
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## References

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/index.html)
- [AWS SDK v3 for JavaScript](https://github.com/aws/aws-sdk-js-v3)
- [S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html)
