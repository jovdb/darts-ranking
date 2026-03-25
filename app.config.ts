import { defineConfig } from "@solidjs/start/config";

const serverPreset = process.env.SERVER_PRESET;
const serverBaseURL = process.env.SERVER_BASE_URL;

export default defineConfig({
  ssr: false,
  vite: {
    server: {
      port: 3000,
    },
  },
  server: {
    ...(serverPreset ? { preset: serverPreset } : {}),
    ...(serverBaseURL ? { baseURL: serverBaseURL } : {}),
  },
});
