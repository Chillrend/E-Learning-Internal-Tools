# E-Learning Internal Tools

An internal web application designed to manage, stage, and automate the bulk deployment of courses to Moodle via its API.

## Features

- **Google OAuth Authentication**: Secure login using Google accounts.
- **Bulk Course Staging**: Organize and preview courses in a staging area grouped by Program Studi and Jurusan before deploying to Moodle.
- **Background Deployments**: Seamlessly handle massive course deployments (200+ courses) asynchronously without browser timeouts, complete with live polling and progress tracking.
- **Deployment History**: Track all past deployments, view success/failure statuses, and reuse past deployments (stage again) for new semesters.
- **Automated Enrolment**: Automatically creates Self Enrolment instances for Teachers (Dosen) and Students (Mahasiswa) with auto-generated alphanumeric keys.
- **Exporting**: Export deployment histories directly to Excel (.xlsx) or PDF for reporting.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (`better-sqlite3`)
- **Frontend**: HTML, TailwindCSS (v4), Handlebars (`hbs`)
- **Auth**: Google APIs (`google-auth-library`)
- **Exporting**: ExcelJS, PDFKit

## Getting Started

### Prerequisites
- Node.js (v18+)
- SQLite3
- A Google Cloud Console project with OAuth 2.0 Client IDs.
- Moodle Server with Web Services (REST/XML-RPC) enabled.

### Installation

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy the example environment file and update it with your settings.
   ```bash
   cp .env.example .env
   ```
   **Required `.env` variables**:
   - `GOOGLE_AUTH_CALLBACK_URL`: The callback URL for Google OAuth (e.g., `http://localhost:3000/login/callback`).
   - `MOODLE_BASE_URL`: The URL of your Moodle instance (e.g., `https://elearning.pnj.ac.id`).

3. **Configure Google Auth**:
   Ensure you have a `clients.json` file in the `secrets` directory containing your Google OAuth web client credentials.
   *(Note: The callback URL in `clients.json` is overridden by `GOOGLE_AUTH_CALLBACK_URL` from `.env`)*

4. **Initialize Database**:
   The SQLite database (`data/elearning.db`) will be automatically created and migrated on first run via `db.js`.

5. **Run the Application**:
   For development (uses nodemon):
   ```bash
   npm run dev
   ```
   For production:
   ```bash
   npm start
   ```

## Docker Deployment

You can easily run the application using Docker and Docker Compose. This ensures a consistent environment and simplifies setup.

1. **Configure Environment Variables**:
   Ensure your `.env` and `secrets/clients.json` are properly configured.
2. **Run with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```
   The application will be available at `http://localhost:3000`. 
   
   The `data/` and `secrets/` directories are mapped as volumes to ensure your SQLite database and credentials persist across container restarts.

## Production Deployment

If you are deploying this application to a production environment with a custom domain:

1. **Update `.env`**:
   Change the `GOOGLE_AUTH_CALLBACK_URL` to your production domain (e.g., `https://tools.yourdomain.com/login/callback`).
2. **Google Cloud Console**:
   Add your new production callback URL to the **Authorized redirect URIs** list in your Google Cloud Console OAuth configuration. Google OAuth requires production domains to be served over **HTTPS**.
3. **Process Manager**:
   Use a process manager like PM2 to keep the Node.js app running in the background.
   ```bash
   npm install -g pm2
   pm2 start bin/www --name "elearning-tools"
   ```
4. **Reverse Proxy (Nginx/Apache)**:
   Set up Nginx or Apache to proxy requests from port 80/443 to your Node application's port (default `3000`), and configure SSL certificates (e.g., via Let's Encrypt).
