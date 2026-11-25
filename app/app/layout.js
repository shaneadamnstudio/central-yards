import './globals.css';

export const metadata = {
  title: 'Central Yards x Adam Studios',
  description: 'Shared workspace for activations, projects, tasks and pitches.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
