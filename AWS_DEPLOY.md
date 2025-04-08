# AWS Elastic Beanstalk Deployment Guide

## Prerequisites

1. Install AWS CLI and EB CLI:
```bash
pip install awscli awsebcli
```

2. Configure AWS credentials:
```bash
aws configure
# Enter your AWS Access Key ID and Secret Access Key
```

## Deployment Steps

1. Initialize Elastic Beanstalk application:
```bash
eb init -p python-3.9 moosic-api
# Select your region when prompted
```

2. Create the environment:
```bash
eb create moosic-api-prod
```

3. Set environment variables in AWS Console:
- Go to Elastic Beanstalk > Environments > moosic-api-prod
- Configuration > Software > Environment properties
- Add these variables:
```
VERCEL_ENV=production
FRONTEND_URL=https://moosic-liart.vercel.app
BACKEND_URL=your-eb-environment-url
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
OPENAI_API_KEY=your_openai_api_key
```

4. Deploy updates:
```bash
eb deploy
```

5. Get your environment URL:
```bash
eb status
# Look for CNAME value
```

## Post-Deployment Steps

1. Update Spotify Developer Dashboard:
- Add new Redirect URI: https://your-eb-environment-url/api/callback
- Add to Allowed Origins: https://your-eb-environment-url

2. Update frontend environment:
- In Vercel dashboard, set BACKEND_URL to your EB environment URL

## Monitoring

- View logs: `eb logs`
- SSH into instance: `eb ssh`
- View health: `eb health`

## Common Issues

1. If deployment fails:
- Check logs: `eb logs`
- Verify environment variables
- Ensure all required files are committed

2. If health checks fail:
- Verify the application is running on port 5000
- Check the health check path (/api/check-auth)
- Review application logs

3. If CORS issues occur:
- Verify FRONTEND_URL is set correctly
- Check CORS configuration in server.py
- Ensure Spotify Dashboard settings are correct

## Local Testing

Test the production configuration locally:
```bash
# Install requirements
pip install -r requirements-aws.txt

# Set environment variables
export VERCEL_ENV=production
export FRONTEND_URL=https://moosic-liart.vercel.app
export BACKEND_URL=http://localhost:5000

# Run with Gunicorn
gunicorn --bind :5000 server:app
```

## Cleanup

To delete the environment:
```bash
eb terminate moosic-api-prod