import app from './index.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Grumpy Tracker running on http://localhost:${PORT}`);
});
