import './globals.css';

export const metadata = {
  title: 'Central Yards x Adam Studios',
  description: 'Shared workspace for activations, projects, tasks and pitches.',
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport = {
  themeColor: '#f5f1e9',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
