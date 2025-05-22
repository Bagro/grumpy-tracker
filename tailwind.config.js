module.exports = {
  content: [
    './src/views/**/*.ejs',
    './src/public/**/*.js',
    './src/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/forms')],
};
