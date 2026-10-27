# Mediaflow

Use Mediaflow files in Contentful entries. Editors pick a file from Mediaflow with the Mediaflow file selector in a JSON object field. The app copies the file to the Mediaflow CDN, stores its metadata (alt text, description, keywords, custom fields, dimensions, …) in the field, shows it in an asset card and keeps it in sync with Mediaflow.

The app authenticates against Mediaflow through a backend hosted by Mediaflow. The backend is not part of this repository.

## Locations

| Location | File | Purpose |
|----------|------|---------|
| App configuration | `src/locations/ConfigScreen.tsx` | Mediaflow OAuth credentials and the "Show links to files in Mediaflow" setting |
| Entry field (JSON object) | `src/locations/Field.tsx` | Select, replace and remove a Mediaflow file, check and sync its metadata |
| Entry sidebar | `src/locations/Sidebar.tsx` | Sync the metadata of every Mediaflow field in the entry |
| Dialog | `src/locations/Dialog.tsx` | Hosts the Mediaflow file selector |

## Installation parameters

| ID | Type | Description |
|----|------|-------------|
| `clientId` | Short text | Mediaflow OAuth client ID |
| `clientSecret` | Secret | Mediaflow OAuth client secret |
| `refreshToken` | Secret | Mediaflow refresh token |
| `showMediaflowLinks` | Boolean (default `true`) | Show links to files in Mediaflow; turn off when editors have no Mediaflow access |

Contact Mediaflow to get OAuth credentials for your Mediaflow account.

## Development

| Command | What it does |
|---------|--------------|
| `npm run install-ci` | Install dependencies |
| `npm start` | Dev server on http://localhost:3000 |
| `npm run build` | Production build in `build/` |
| `npm run lint` | Type check and ESLint |
| `npm test` | Run the tests with coverage (`npm run test:watch` watches) |

The backend URL is set as `VITE_BACKEND_URL` in `.env.production` (must end with `/`).
