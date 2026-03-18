// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    pageTransition: { name: "page", mode: "out-in" },
  },
  modules: ["@nuxtjs/tailwindcss", "@vueuse/nuxt", "@pinia/nuxt", "nuxt-auth-utils"],
  link: [
    {
      rel: "stylesheet",
      href: "https://cdn.bootcdn.net/ajax/libs/font-awesome/6.1.0/css/all.min.css",
    },
  ],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || "",
    jwtSecret: process.env.JWT_SECRET!
  }
});
