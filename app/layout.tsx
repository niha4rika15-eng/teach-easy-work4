import '../globals.css'

export const metadata = {
  title: 'Teach Easy',
  description: 'A workspace for professors and students.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
