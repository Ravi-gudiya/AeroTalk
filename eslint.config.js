export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/uploads/**"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node globals
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        // Browser globals
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        alert: "readonly",
        prompt: "readonly",
        confirm: "readonly",
        navigator: "readonly",
        caches: "readonly",
        self: "readonly",
        clients: "readonly",
        URL: "readonly",
        Event: "readonly",
        WebSocket: "readonly",
        FormData: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        File: "readonly",
        Notification: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-console": "off",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "multi-line"]
    }
  }
];
