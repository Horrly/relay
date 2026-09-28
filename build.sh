#!/usr/bin/env bash
# Render build script: builds the React app, then installs and prepares Django.
set -o errexit

echo "==> Building frontend"
cd frontend
npm ci
npm run build

echo "==> Installing backend"
cd ../backend
pip install -r requirements.txt
python manage.py collectstatic --noinput
