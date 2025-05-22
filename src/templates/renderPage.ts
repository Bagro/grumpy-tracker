// HTML layout wrapper for Grumpy Tracker
export function renderPage(content: string): string {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Grumpy Tracker</title>
      <link rel="stylesheet" href="/static/otailwind.css">
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    </head>
    <body class="bg-gray-100 min-h-screen">
      <main id="main-content" class="flex flex-col items-center justify-center min-h-screen">
        ${content}
      </main>
    </body>
  </html>`;
}
