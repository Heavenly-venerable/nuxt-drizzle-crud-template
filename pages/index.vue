<template>
  <div class="min-h-screen">
    <!-- Hero Section -->
    <section class="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
      <div class="container mx-auto px-4 py-20">
        <h1 class="text-5xl font-bold mb-4">Nuxt + Nitro + Drizzle + Tailwind</h1>
        <p class="text-xl mb-8">Full-stack application with PostgreSQL and modern tooling</p>
        <div class="flex gap-4">
          <NuxtLink to="/users"
            class="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
            View Users
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="container mx-auto px-4 py-16">
      <h2 class="text-3xl font-bold text-center mb-12">Technology Stack</h2>
      <div class="grid md:grid-cols-4 gap-8">
        <div v-for="tech in technologies" :key="tech.name" class="bg-white p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-bold mb-2">{{ tech.name }}</h3>
          <p class="text-gray-600">{{ tech.description }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const technologies = [
  {
    name: 'Nuxt 3',
    description: 'Vue.js framework with server-side rendering and file-based routing'
  },
  {
    name: 'Nitro',
    description: 'Server engine for building full-stack applications with API routes'
  },
  {
    name: 'Drizzle ORM',
    description: 'TypeScript ORM for SQL databases with type-safe queries'
  },
  {
    name: 'TailwindCSS',
    description: 'Utility-first CSS framework for rapid UI development'
  }
];
</script>
