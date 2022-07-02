module.exports = {
  apps: [
    {
      name: "silverion",
      script: "src/silverion/index.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "2000M",
      watch: false,
      time: true
    }
  ]
};