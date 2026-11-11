import { defineConfig } from "vite";

/* 데모 페이지가 둘이므로 빌드 입력을 모두 적는다. */
export default defineConfig({
  build: {
    rollupOptions: { input: ["index.html", "phase2.html", "flights.html"] },
  },
});
