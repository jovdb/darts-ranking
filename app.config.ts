import { defineConfig } from "@solidjs/start/config";
import staticAdapter from "solid-start-static";

export default defineConfig({
  adapters: [
    staticAdapter({
      base: "/darts-ranking/",
    }),
  ],
});
