# UI Stack

This stack represents the UI Single Page Application (SPA). It is hosted as a static artifact in an S3 bucket and made accessible via CloudFront.

## Deployment Requirements

Before deploying the UI stack, ensure the following:
- A `.env` file is required, where:
   - All API Gateway endpoints for the backend domains are configured.
  - AWS Cognito variables are properly set.

- Run a build process in the /ui folder to generate the required static files: `npm run build`