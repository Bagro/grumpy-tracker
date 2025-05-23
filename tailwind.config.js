module.exports = {
  content: [
    './src/views/**/*.ejs',
    './src/public/**/*.js',
    './src/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        grumpy: {
          orange: '#e76a2e',
          dark: '#181816',
          dark2: '#23211e',
          offwhite: '#f6eadd',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
