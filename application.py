#!/usr/bin/env python3

import os
from server import app

# Configure for AWS Elastic Beanstalk
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)