#!/usr/bin/env python3

import os
import logging
from server import app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the WSGI application
application = app

if __name__ == '__main__':
    try:
        port = int(os.environ.get('PORT', 3001))
        logger.info(f'Starting application on port {port}')
        application.run(host='0.0.0.0', port=port)
    except Exception as e:
        logger.error(f'Failed to start application: {str(e)}')
        raise