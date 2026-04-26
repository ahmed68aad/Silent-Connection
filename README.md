# Silent Connection

Local full-stack app with a Vite React client and an Express API.

## Run Locally

1. Install server dependencies:

   ```powershell
   cd server
   npm install
   Copy-Item .env.example .env
   ```

2. Update `server/.env` if your MongoDB URL or ports are different, then start the API:

   ```powershell
   npm run dev
   ```

3. In another terminal, install client dependencies:

   ```powershell
   cd client
   npm install
   Copy-Item .env.example .env
   ```

4. Start the client:
   ```powershell
   npm run dev
   ```

The client runs at `http://localhost:5173` and the API runs at `http://localhost:3000`.

The backend uses the local MongoDB database named `silent`.
